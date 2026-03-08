import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchYahooData(symbol: string, fromDate?: Date): Promise<{
  price: number | null;
  splits: { date: string; numerator: number; denominator: number }[];
  dividends: { date: string; amount: number }[];
}> {
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

    // Parse splits
    const splitsRaw = result?.events?.splits;
    const splits = splitsRaw
      ? Object.values(splitsRaw).map((s: any) => ({
          date: new Date(s.date * 1000).toISOString().split('T')[0],
          numerator: s.numerator,
          denominator: s.denominator,
        }))
      : [];

    // Parse dividends
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

    // Get earliest transaction date per holding
    const { data: txDates } = await supabase
      .from('transactions')
      .select('holding_id, transaction_date')
      .eq('transaction_type', 'buy')
      .order('transaction_date', { ascending: true });

    const earliestTxDate: Record<string, string> = {};
    for (const tx of txDates || []) {
      if (!earliestTxDate[tx.holding_id] || tx.transaction_date < earliestTxDate[tx.holding_id]) {
        earliestTxDate[tx.holding_id] = tx.transaction_date;
      }
    }

    // Get quantity at each dividend date from transactions
    function getQuantityAtDate(holdingId: string, date: string): number {
      const txs = (txDates || []).filter(t => t.holding_id === holdingId);
      // For now use all buy txs before date
      let qty = 0;
      for (const tx of allTxs.filter(t => t.holding_id === holdingId && t.transaction_date <= date)) {
        if (tx.transaction_type === 'buy') qty += tx.quantity;
        else if (tx.transaction_type === 'sell') qty -= tx.quantity;
      }
      return qty > 0 ? qty : 0;
    }

    // Get ALL transactions for quantity-at-date calculation
    const { data: allTxs } = await supabase
      .from('transactions')
      .select('holding_id, transaction_type, quantity, transaction_date')
      .order('transaction_date', { ascending: true });

    let updated = 0;
    let failed = 0;
    let splitsDetected = 0;
    let dividendsAdded = 0;

    for (const holding of holdings || []) {
      if (holding.asset_type === 'israeli_fund') continue;

      const yahooSymbol = getYahooSymbol(holding);

      // Get events from earliest transaction minus 1 month buffer
      const earliestDate = earliestTxDate[holding.id]
        ? new Date(earliestTxDate[holding.id])
        : new Date(holding.created_at || '2020-01-01');
      const eventsFrom = new Date(earliestDate);
      eventsFrom.setMonth(eventsFrom.getMonth() - 1);

      // Single API call per holding: price + splits + dividends
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

      // Store splits
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
        }
      }

      // Store dividends
      for (const div of dividends) {
        const holdingStart = earliestTxDate[holding.id]
          ? new Date(earliestTxDate[holding.id])
          : null;

        // Only add dividends after user first purchased
        if (!holdingStart || new Date(div.date) < holdingStart) continue;

        // Check if already exists
        const { data: existing } = await supabase
          .from('dividends')
          .select('id')
          .eq('holding_id', holding.id)
          .eq('payment_date', div.date)
          .maybeSingle();

        if (!existing) {
          // Calculate shares held at dividend date from transactions
          const qtyAtDate = (() => {
            let qty = 0;
            for (const tx of (allTxs || []).filter(t => t.holding_id === holding.id && t.transaction_date <= div.date)) {
              if (tx.transaction_type === 'buy') qty += tx.quantity;
              else if (tx.transaction_type === 'sell') qty -= tx.quantity;
            }
            return qty > 0 ? qty : holding.quantity;
          })();

          const totalAmount = div.amount * qtyAtDate;
          const taxRate = holding.currency === 'USD' ? 0.25 : 0.15;
          
          console.log(`Adding dividend for ${holding.symbol}: ${div.date}, $${div.amount}/share × ${qtyAtDate} shares = $${totalAmount.toFixed(2)}`);
          
          const { error: divError } = await supabase
            .from('dividends')
            .insert({
              holding_id: holding.id,
              user_id: holding.user_id,
              amount: totalAmount,
              currency: holding.currency || 'USD',
              payment_date: div.date,
              ex_date: div.date,
              shares_at_payment: qtyAtDate,
              is_israeli: holding.currency === 'ILS',
              tax_withheld: totalAmount * taxRate,
              notes: `דיבידנד $${div.amount}/מניה — יובא אוטומטית`,
            });
          if (!divError) dividendsAdded++;
          else console.error(`Dividend insert error for ${holding.symbol}:`, divError);
        }
      }

      // Rate limit - shorter delay since we do 1 call per holding now
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

    console.log(`Done: ${updated} updated, ${failed} failed, ${splitsDetected} splits, ${dividendsAdded} dividends`);

    return new Response(
      JSON.stringify({ success: true, updated, failed, splitsDetected, dividendsAdded, rates_updated: !!rates }),
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
