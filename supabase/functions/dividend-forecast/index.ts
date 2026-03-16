import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getYahooSymbol(symbol: string, currency: string | null, assetType: string): string {
  if (currency === 'ILS' && assetType === 'stock') {
    if (!symbol.endsWith('.TA')) return `${symbol}.TA`;
  }
  return symbol;
}

async function fetchQuoteSummary(symbol: string): Promise<{
  exDividendDate: string | null;
  dividendDate: string | null;
  dividendRate: number | null;
  dividendYield: number | null;
  price: number | null;
} | null> {
  try {
    // Use v10 quoteSummary with calendarEvents + summaryDetail
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents,summaryDetail,price`;
    
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!res.ok) {
      console.log(`quoteSummary returned ${res.status} for ${symbol}, trying chart fallback`);
      return await fetchChartFallback(symbol);
    }

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return await fetchChartFallback(symbol);

    const cal = result.calendarEvents;
    const summary = result.summaryDetail;
    const priceData = result.price;

    const exDivRaw = cal?.exDividendDate?.raw;
    const divDateRaw = cal?.dividendDate?.raw;

    return {
      exDividendDate: exDivRaw ? new Date(exDivRaw * 1000).toISOString().split('T')[0] : null,
      dividendDate: divDateRaw ? new Date(divDateRaw * 1000).toISOString().split('T')[0] : null,
      dividendRate: summary?.dividendRate?.raw ?? cal?.dividendRate?.raw ?? null,
      dividendYield: summary?.dividendYield?.raw ? summary.dividendYield.raw * 100 : null,
      price: priceData?.regularMarketPrice?.raw ?? null,
    };
  } catch (err) {
    console.error(`Error fetching quoteSummary for ${symbol}:`, err);
    return await fetchChartFallback(symbol);
  }
}

async function fetchChartFallback(symbol: string): Promise<{
  exDividendDate: string | null;
  dividendDate: string | null;
  dividendRate: number | null;
  dividendYield: number | null;
  price: number | null;
} | null> {
  try {
    const period1 = Math.floor((Date.now() - 365 * 86400000) / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div`;
    
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const price = result?.meta?.regularMarketPrice ?? null;
    const divsRaw = result?.events?.dividends;
    
    if (!divsRaw) return { exDividendDate: null, dividendDate: null, dividendRate: null, dividendYield: null, price };

    const divs = Object.values(divsRaw).map((d: any) => ({
      date: new Date(d.date * 1000).toISOString().split('T')[0],
      amount: d.amount,
    })).sort((a: any, b: any) => b.date.localeCompare(a.date));

    if (divs.length === 0) return { exDividendDate: null, dividendDate: null, dividendRate: null, dividendYield: null, price };

    // Calculate annual rate from last year's dividends
    const annualRate = divs.reduce((sum: number, d: any) => sum + d.amount, 0);
    const yieldPct = price && price > 0 ? (annualRate / price) * 100 : null;

    return {
      exDividendDate: divs[0].date, // Last known ex-date
      dividendDate: null, // Can't determine from chart
      dividendRate: annualRate,
      dividendYield: yieldPct,
      price,
    };
  } catch (err) {
    console.error(`Chart fallback error for ${symbol}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('id, symbol, name, currency, asset_type, quantity, average_cost, current_price')
      .eq('user_id', user.id)
      .gt('quantity', 0);

    if (holdingsError) throw holdingsError;

    // Get last dividend per holding
    const { data: lastDivs } = await supabase
      .from('dividends')
      .select('holding_id, amount, shares_at_payment, payment_date')
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false });

    const lastDivByHolding = new Map<string, number>();
    for (const d of lastDivs || []) {
      if (!lastDivByHolding.has(d.holding_id) && d.shares_at_payment && d.shares_at_payment > 0) {
        lastDivByHolding.set(d.holding_id, d.amount / d.shares_at_payment);
      }
    }

    const forecasts: any[] = [];

    for (const holding of holdings || []) {
      if (holding.asset_type === 'israeli_fund') continue;

      const yahooSymbol = getYahooSymbol(holding.symbol, holding.currency, holding.asset_type);
      const quote = await fetchQuoteSummary(yahooSymbol);
      
      if (!quote) {
        console.log(`No data for ${yahooSymbol}`);
        continue;
      }

      const annualTotal = (quote.dividendRate || 0) * holding.quantity;
      const costBasis = holding.average_cost * holding.quantity;
      const yieldOnCost = costBasis > 0 && quote.dividendRate ? (quote.dividendRate * holding.quantity / costBasis) * 100 : null;

      forecasts.push({
        holdingId: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        currency: holding.currency || 'USD',
        quantity: holding.quantity,
        averageCost: holding.average_cost,
        currentPrice: quote.price || holding.current_price,
        exDividendDate: quote.exDividendDate,
        dividendDate: quote.dividendDate,
        dividendRate: quote.dividendRate,
        dividendYield: quote.dividendYield,
        yieldOnCost,
        annualTotal,
        lastDividendPerShare: lastDivByHolding.get(holding.id) ?? null,
      });

      // Rate limit between symbols
      await new Promise(r => setTimeout(r, 200));
    }

    // Sort: upcoming ex-dates first
    forecasts.sort((a, b) => {
      const today = new Date().toISOString().split('T')[0];
      const aUpcoming = a.exDividendDate && a.exDividendDate >= today;
      const bUpcoming = b.exDividendDate && b.exDividendDate >= today;
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;
      return (b.annualTotal || 0) - (a.annualTotal || 0);
    });

    return new Response(JSON.stringify({ forecasts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
