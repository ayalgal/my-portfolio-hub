import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    console.error(`Failed to fetch price for ${symbol}`);
    return null;
  }
}

interface SplitEvent {
  date: string;
  numerator: number;
  denominator: number;
}

interface DividendEvent {
  date: string;
  amount: number;
}

async function fetchYahooSplitsAndDividends(symbol: string, fromDate: Date): Promise<{ splits: SplitEvent[]; dividends: DividendEvent[] }> {
  try {
    const period1 = Math.floor(fromDate.getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=splits,div`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return { splits: [], dividends: [] };
    const data = await res.json();
    const result = data?.chart?.result?.[0];

    // Parse splits
    const splitsRaw = result?.events?.splits;
    const splits: SplitEvent[] = splitsRaw
      ? Object.values(splitsRaw).map((s: any) => ({
          date: new Date(s.date * 1000).toISOString().split('T')[0],
          numerator: s.numerator,
          denominator: s.denominator,
        }))
      : [];

    // Parse dividends
    const divsRaw = result?.events?.dividends;
    const dividends: DividendEvent[] = divsRaw
      ? Object.values(divsRaw).map((d: any) => ({
          date: new Date(d.date * 1000).toISOString().split('T')[0],
          amount: d.amount,
        }))
      : [];

    return { splits, dividends };
  } catch {
    console.error(`Failed to fetch events for ${symbol}`);
    return { splits: [], dividends: [] };
  }
}

async function fetchExchangeRates(): Promise<{ USDILS: number; CADILS: number; USDCAD: number } | null> {
  try {
    const pairs = ['USDILS=X', 'CADILS=X'];
    const rates: Record<string, number> = {};
    for (const pair of pairs) {
      const price = await fetchYahooPrice(pair);
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

    let updated = 0;
    let failed = 0;
    let splitsDetected = 0;
    let dividendsAdded = 0;

    for (const holding of holdings || []) {
      if (holding.asset_type === 'israeli_fund') continue;

      const yahooSymbol = getYahooSymbol(holding);

      // Fetch price
      const price = await fetchYahooPrice(yahooSymbol);
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

      // Fetch splits and dividends
      const createdAt = new Date(holding.created_at || '2020-01-01');
      // Fetch events from 2 years before created_at to catch historical dividends
      const eventsFrom = new Date(createdAt);
      eventsFrom.setFullYear(eventsFrom.getFullYear() - 2);
      const { splits, dividends } = await fetchYahooSplitsAndDividends(yahooSymbol, eventsFrom);

      // Store splits
      for (const split of splits) {
        const { error: splitError } = await supabase
          .from('stock_splits')
          .upsert({
            holding_id: holding.id,
            user_id: holding.user_id,
            symbol: holding.symbol,
            split_date: split.date,
            ratio_from: split.denominator,
            ratio_to: split.numerator,
            status: 'pending',
          }, {
            onConflict: 'holding_id,split_date,ratio_from,ratio_to',
            ignoreDuplicates: true,
          });
        if (!splitError) splitsDetected++;
      }

      // Store dividends — only for dates when user held the stock
      for (const div of dividends) {
        const divDate = new Date(div.date);
        const holdingCreated = new Date(holding.created_at || '2099-01-01');
        
        // Only add dividends after user purchased (use created_at as proxy)
        if (divDate < holdingCreated) continue;

        // Upsert dividend — use holding_id + payment_date as natural key
        const { data: existing } = await supabase
          .from('dividends')
          .select('id')
          .eq('holding_id', holding.id)
          .eq('payment_date', div.date)
          .maybeSingle();

        if (!existing) {
          const totalAmount = div.amount * holding.quantity;
          const taxRate = holding.currency === 'USD' ? 0.25 : 0.15;
          const { error: divError } = await supabase
            .from('dividends')
            .insert({
              holding_id: holding.id,
              user_id: holding.user_id,
              amount: totalAmount,
              currency: holding.currency || 'USD',
              payment_date: div.date,
              ex_date: div.date,
              shares_at_payment: holding.quantity,
              is_israeli: holding.currency === 'ILS',
              tax_withheld: totalAmount * taxRate,
              notes: `דיבידנד $${div.amount}/מניה — יובא אוטומטית`,
            });
          if (!divError) dividendsAdded++;
        }
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200));
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
