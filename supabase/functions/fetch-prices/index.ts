import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price ?? null;
  } catch {
    console.error(`Failed to fetch price for ${symbol}`);
    return null;
  }
}

interface SplitEvent {
  date: string; // YYYY-MM-DD
  numerator: number;
  denominator: number;
}

async function fetchYahooSplits(symbol: string, fromDate: Date): Promise<SplitEvent[]> {
  try {
    const period1 = Math.floor(fromDate.getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=splits`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const splits = data?.chart?.result?.[0]?.events?.splits;
    if (!splits) return [];

    return Object.values(splits).map((s: any) => {
      const d = new Date(s.date * 1000);
      return {
        date: d.toISOString().split('T')[0],
        numerator: s.numerator,
        denominator: s.denominator,
      };
    });
  } catch {
    console.error(`Failed to fetch splits for ${symbol}`);
    return [];
  }
}

async function fetchExchangeRates(): Promise<{ USDILS: number; CADILS: number; USDCAD: number } | null> {
  try {
    const pairs = ['USDILS=X', 'CADILS=X'];
    const rates: Record<string, number> = {};
    
    for (const pair of pairs) {
      const price = await fetchYahooPrice(pair);
      if (price) {
        const key = pair.replace('=X', '');
        rates[key] = price;
      }
    }
    
    return {
      USDILS: rates['USDILS'] || 3.7,
      CADILS: rates['CADILS'] || 2.7,
      USDCAD: rates['USDILS'] && rates['CADILS'] ? rates['USDILS'] / rates['CADILS'] : 1.37,
    };
  } catch {
    console.error('Failed to fetch exchange rates');
    return null;
  }
}

function getYahooSymbol(holding: { symbol: string; asset_type: string; currency: string | null }): string {
  const symbol = holding.symbol;
  if (holding.currency === 'ILS' && holding.asset_type === 'stock') {
    if (!symbol.endsWith('.TA')) return `${symbol}.TA`;
  }
  return symbol;
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

    for (const holding of holdings || []) {
      if (holding.asset_type === 'israeli_fund') continue;

      const yahooSymbol = getYahooSymbol(holding);
      
      // Fetch price
      const price = await fetchYahooPrice(yahooSymbol);
      if (price !== null) {
        const { error } = await supabase
          .from('holdings')
          .update({
            current_price: price,
            last_price_update: new Date().toISOString(),
          })
          .eq('id', holding.id);
        if (!error) updated++;
        else failed++;
      } else {
        failed++;
      }

      // Fetch splits since the holding was created
      const createdAt = new Date(holding.created_at || '2020-01-01');
      const splits = await fetchYahooSplits(yahooSymbol, createdAt);

      for (const split of splits) {
        // Insert as pending if not already exists
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
      JSON.stringify({ success: true, updated, failed, splitsDetected, rates_updated: !!rates }),
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
