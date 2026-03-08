import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface YahooResult {
  price: number | null;
  splits: { date: string; numerator: number; denominator: number }[];
  dividends: { date: string; amount: number }[];
}

async function fetchYahooData(symbol: string, fromDate?: Date): Promise<YahooResult> {
  try {
    const period1 = fromDate ? Math.floor(fromDate.getTime() / 1000) : Math.floor((Date.now() - 2 * 365 * 86400000) / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=splits%2Cdiv`;
    
    console.log(`Fetching Yahoo data for ${symbol}`);
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!res.ok) {
      console.log(`Yahoo returned ${res.status} for ${symbol}`);
      return { price: null, splits: [], dividends: [] };
    }
    
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      console.log(`No chart result for ${symbol}`);
      return { price: null, splits: [], dividends: [] };
    }

    const price = result?.meta?.regularMarketPrice ?? null;

    const splitsRaw = result?.events?.splits;
    const splits = splitsRaw
      ? Object.values(splitsRaw).map((s: any) => ({
          date: new Date(s.date * 1000).toISOString().split('T')[0],
          numerator: s.numerator,
          denominator: s.denominator,
        }))
      : [];

    const divsRaw = result?.events?.dividends;
    const dividends = divsRaw
      ? Object.values(divsRaw).map((d: any) => ({
          date: new Date(d.date * 1000).toISOString().split('T')[0],
          amount: d.amount,
        }))
      : [];

    console.log(`${symbol}: price=${price}, splits=${splits.length}, dividends=${dividends.length}`);
    return { price, splits, dividends };
  } catch (err) {
    console.error(`Error fetching ${symbol}:`, err);
    return { price: null, splits: [], dividends: [] };
  }
}

async function fetchExchangeRates(): Promise<{ USDILS: number; CADILS: number; USDCAD: number } | null> {
  try {
    const pairs = ['USDILS=X', 'CADILS=X'];
    const rates: Record<string, number> = {};
    for (const pair of pairs) {
      const { price } = await fetchYahooData(pair);
      if (price) rates[pair.replace('=X', '')] = price;
    }
    return {
      USDILS: rates['USDILS'] || 3.7,
      CADILS: rates['CADILS'] || 2.7,
      USDCAD: rates['USDILS'] && rates['CADILS'] ? rates['USDILS'] / rates['CADILS'] : 1.37,
    };
  } catch {
    return null;
  }
}

function getYahooSymbol(holding: { symbol: string; asset_type: string; currency: string | null }): string {
  if (holding.currency === 'ILS' && holding.asset_type === 'stock') {
    if (!holding.symbol.endsWith('.TA')) return `${holding.symbol}.TA`;
  }
  return holding.symbol;
}

interface Transaction {
  holding_id: string;
  transaction_type: string;
  quantity: number;
  transaction_date: string;
  split_ratio_from: number | null;
  split_ratio_to: number | null;
}

/**
 * Calculate the number of shares held on a given date,
 * accounting for buy/sell transactions AND stock splits.
 * 
 * Yahoo reports dividends per CURRENT (post-split) share.
 * So we need the split-adjusted quantity at the ex-date.
 */
function calcSharesAtDate(
  holdingTxs: Transaction[],
  splits: { date: string; numerator: number; denominator: number }[],
  targetDate: string,
): number {
  // Sort transactions by date
  const sorted = holdingTxs
    .filter(t => t.transaction_date <= targetDate)
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  // Get all splits up to targetDate, sorted
  const relevantSplits = splits
    .filter(s => s.date <= targetDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Walk through time: process transactions and splits in order
  let qty = 0;
  let txIdx = 0;
  let splitIdx = 0;

  // Merge events by date
  while (txIdx < sorted.length || splitIdx < relevantSplits.length) {
    const txDate = txIdx < sorted.length ? sorted[txIdx].transaction_date : '9999-12-31';
    const splitDate = splitIdx < relevantSplits.length ? relevantSplits[splitIdx].date : '9999-12-31';

    if (txDate <= splitDate) {
      const tx = sorted[txIdx];
      if (tx.transaction_type === 'buy') qty += tx.quantity;
      else if (tx.transaction_type === 'sell') qty -= tx.quantity;
      txIdx++;
    } else {
      // Apply split: multiply existing qty by split ratio
      const split = relevantSplits[splitIdx];
      qty = qty * (split.numerator / split.denominator);
      splitIdx++;
    }
  }

  return Math.max(0, qty);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('id, symbol, asset_type, currency, user_id, created_at, quantity')
      .gt('quantity', 0);

    if (holdingsError) throw holdingsError;
    console.log(`Processing ${holdings?.length || 0} holdings`);

    // Get ALL transactions for quantity-at-date calculations
    const { data: allTxs } = await supabase
      .from('transactions')
      .select('holding_id, transaction_type, quantity, transaction_date, split_ratio_from, split_ratio_to')
      .order('transaction_date', { ascending: true });

    // Build earliest buy date per holding
    const earliestBuyDate: Record<string, string> = {};
    for (const tx of allTxs || []) {
      if (tx.transaction_type === 'buy') {
        if (!earliestBuyDate[tx.holding_id] || tx.transaction_date < earliestBuyDate[tx.holding_id]) {
          earliestBuyDate[tx.holding_id] = tx.transaction_date;
        }
      }
    }

    // Get existing dividends to avoid duplicates
    const { data: existingDividends } = await supabase
      .from('dividends')
      .select('holding_id, payment_date');
    
    const existingDivSet = new Set(
      (existingDividends || []).map(d => `${d.holding_id}_${d.payment_date}`)
    );

    let updated = 0;
    let failed = 0;
    let splitsDetected = 0;
    let dividendsAdded = 0;
    let eventsCreated = 0;

    // Get existing events to avoid duplicates
    const { data: existingEvents } = await supabase
      .from('stock_events')
      .select('holding_id, event_type, event_date');
    const existingEventSet = new Set(
      (existingEvents || []).map(e => `${e.holding_id}_${e.event_type}_${e.event_date}`)
    );

    for (const holding of holdings || []) {
      if (holding.asset_type === 'israeli_fund') continue;

      const yahooSymbol = getYahooSymbol(holding);

      // Fetch from earliest buy minus 1 month
      const earliest = earliestBuyDate[holding.id]
        ? new Date(earliestBuyDate[holding.id])
        : new Date(holding.created_at || '2020-01-01');
      const eventsFrom = new Date(earliest);
      eventsFrom.setMonth(eventsFrom.getMonth() - 1);

      const { price, splits, dividends } = await fetchYahooData(yahooSymbol, eventsFrom);

      // Update price
      if (price !== null) {
        const { error } = await supabase
          .from('holdings')
          .update({ current_price: price, last_price_update: new Date().toISOString() })
          .eq('id', holding.id);
        if (!error) updated++;
        else failed++;
      } else {
        failed++;
      }

      // Store splits + create events
      for (const split of splits) {
        const { data: existingSplit } = await supabase
          .from('stock_splits')
          .select('id')
          .eq('holding_id', holding.id)
          .eq('split_date', split.date)
          .maybeSingle();

        if (!existingSplit) {
          await supabase.from('stock_splits').insert({
            holding_id: holding.id,
            user_id: holding.user_id,
            symbol: holding.symbol,
            split_date: split.date,
            ratio_from: split.denominator,
            ratio_to: split.numerator,
            status: 'pending',
          });
          splitsDetected++;

          // Create event notification
          const ratio = split.numerator / split.denominator;
          const eventType = ratio > 1 ? 'split' : 'reverse_split';
          const eventKey = `${holding.id}_${eventType}_${split.date}`;
          if (!existingEventSet.has(eventKey)) {
            const title = ratio > 1
              ? `ספליט ${split.denominator}:${split.numerator} — ${holding.symbol}`
              : `איחוד מניות ${split.denominator}:${split.numerator} — ${holding.symbol}`;
            await supabase.from('stock_events').insert({
              user_id: holding.user_id,
              holding_id: holding.id,
              symbol: holding.symbol,
              event_type: eventType,
              title,
              description: `זוהה אוטומטית. נא לבדוק בדף המניה ולהחליט אם להחיל.`,
              event_date: split.date,
            });
            existingEventSet.add(eventKey);
            eventsCreated++;
          }
        }
      }

      // Store dividends — only if user held shares on ex-date
      const holdingTxs = (allTxs || []).filter(t => t.holding_id === holding.id) as Transaction[];
      const firstBuy = earliestBuyDate[holding.id];

      // Track for dividend change events
      let lastDivAmount: number | null = null;
      const sortedDivs = [...dividends].sort((a, b) => a.date.localeCompare(b.date));

      for (const div of sortedDivs) {
        // Skip dividends before user ever owned the holding
        if (!firstBuy || div.date < firstBuy) {
          lastDivAmount = div.amount;
          continue;
        }

        // Skip if already exists
        const key = `${holding.id}_${div.date}`;
        if (existingDivSet.has(key)) {
          lastDivAmount = div.amount;
          continue;
        }

        // Calculate split-adjusted shares at ex-date
        const sharesAtExDate = calcSharesAtDate(holdingTxs, splits, div.date);

        if (sharesAtExDate <= 0) {
          console.log(`${holding.symbol}: 0 shares at ex-date ${div.date}, skipping dividend`);
          lastDivAmount = div.amount;
          continue;
        }

        // Yahoo dividend amount is per share (post-split adjusted)
        const totalAmount = div.amount * sharesAtExDate;
        const taxRate = holding.currency === 'USD' ? 0.25 : 0.15;

        console.log(`Adding dividend: ${holding.symbol} ${div.date}, $${div.amount}/share × ${sharesAtExDate} shares = $${totalAmount.toFixed(2)}`);

        const { error: divError } = await supabase
          .from('dividends')
          .insert({
            holding_id: holding.id,
            user_id: holding.user_id,
            amount: totalAmount,
            currency: holding.currency || 'USD',
            payment_date: div.date,
            ex_date: div.date,
            shares_at_payment: sharesAtExDate,
            is_israeli: holding.currency === 'ILS',
            tax_withheld: totalAmount * taxRate,
            notes: `דיבידנד $${div.amount}/מניה — יובא אוטומטית`,
          });

        if (!divError) {
          dividendsAdded++;
          existingDivSet.add(key);

          // Create event for significant dividend changes (>15% change)
          if (lastDivAmount !== null && lastDivAmount > 0) {
            const changePct = ((div.amount - lastDivAmount) / lastDivAmount) * 100;
            if (Math.abs(changePct) > 15) {
              const eventType = changePct > 0 ? 'dividend_increase' : 'dividend_cut';
              const eventKey = `${holding.id}_${eventType}_${div.date}`;
              if (!existingEventSet.has(eventKey)) {
                await supabase.from('stock_events').insert({
                  user_id: holding.user_id,
                  holding_id: holding.id,
                  symbol: holding.symbol,
                  event_type: eventType,
                  title: changePct > 0
                    ? `עליית דיבידנד ${changePct.toFixed(0)}% — ${holding.symbol}`
                    : `קיצוץ דיבידנד ${changePct.toFixed(0)}% — ${holding.symbol}`,
                  description: `$${lastDivAmount.toFixed(4)} → $${div.amount.toFixed(4)} למניה`,
                  event_date: div.date,
                });
                existingEventSet.add(eventKey);
                eventsCreated++;
              }
            }
          }
        } else {
          console.error(`Dividend insert error for ${holding.symbol}:`, divError);
        }

        lastDivAmount = div.amount;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 150));
    }

    // Update exchange rates
    const rates = await fetchExchangeRates();
    if (rates) {
      const rateEntries = [
        { from_currency: 'USD', to_currency: 'ILS', rate: rates.USDILS },
        { from_currency: 'CAD', to_currency: 'ILS', rate: rates.CADILS },
        { from_currency: 'USD', to_currency: 'CAD', rate: rates.USDCAD },
      ];
      for (const entry of rateEntries) {
        await supabase
          .from('exchange_rates')
          .upsert(
            { ...entry, updated_at: new Date().toISOString() },
            { onConflict: 'from_currency,to_currency' }
          );
      }
    }

    console.log(`Done: ${updated} updated, ${failed} failed, ${splitsDetected} splits, ${dividendsAdded} dividends, ${eventsCreated} events`);

    return new Response(
      JSON.stringify({ success: true, updated, failed, splitsDetected, dividendsAdded, eventsCreated, rates_updated: !!rates }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
