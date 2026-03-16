import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DividendInfo {
  holdingId: string;
  symbol: string;
  name: string;
  currency: string;
  quantity: number;
  averageCost: number;
  currentPrice: number | null;
  // From Yahoo
  exDividendDate: string | null;
  dividendDate: string | null;
  dividendRate: number | null; // annual per share
  dividendYield: number | null;
  lastDividendValue: number | null; // per share, last payment
}

function getYahooSymbol(symbol: string, currency: string | null, assetType: string): string {
  if (currency === 'ILS' && assetType === 'stock') {
    if (!symbol.endsWith('.TA')) return `${symbol}.TA`;
  }
  return symbol;
}

async function fetchQuoteData(symbols: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  
  // Batch up to 20 symbols per request
  for (let i = 0; i < symbols.length; i += 20) {
    const batch = symbols.slice(i, i + 20);
    const symbolsStr = batch.join(',');
    
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolsStr)}&fields=symbol,dividendDate,exDividendDate,trailingAnnualDividendRate,trailingAnnualDividendYield,regularMarketPrice`;
      
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      
      if (!res.ok) {
        console.log(`Yahoo quote returned ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      const quotes = data?.quoteResponse?.result || [];
      
      for (const q of quotes) {
        results[q.symbol] = {
          dividendDate: q.dividendDate ? new Date(q.dividendDate * 1000).toISOString().split('T')[0] : null,
          exDividendDate: q.exDividendDate ? new Date(q.exDividendDate * 1000).toISOString().split('T')[0] : null,
          trailingAnnualDividendRate: q.trailingAnnualDividendRate ?? null,
          trailingAnnualDividendYield: q.trailingAnnualDividendYield ?? null,
          regularMarketPrice: q.regularMarketPrice ?? null,
        };
      }
    } catch (err) {
      console.error('Error fetching quotes:', err);
    }
    
    if (i + 20 < symbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  return results;
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

    // Get user's holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('id, symbol, name, currency, asset_type, quantity, average_cost, current_price')
      .eq('user_id', user.id)
      .gt('quantity', 0);

    if (holdingsError) throw holdingsError;

    // Get last dividend per holding for context
    const { data: lastDivs } = await supabase
      .from('dividends')
      .select('holding_id, amount, shares_at_payment, payment_date')
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false });

    const lastDivByHolding = new Map<string, { amount: number; shares: number }>();
    for (const d of lastDivs || []) {
      if (!lastDivByHolding.has(d.holding_id) && d.shares_at_payment && d.shares_at_payment > 0) {
        lastDivByHolding.set(d.holding_id, {
          amount: d.amount / d.shares_at_payment,
          shares: d.shares_at_payment,
        });
      }
    }

    // Build Yahoo symbols
    const symbolMap = new Map<string, typeof holdings[0]>();
    const yahooSymbols: string[] = [];
    for (const h of holdings || []) {
      if (h.asset_type === 'israeli_fund') continue;
      const ys = getYahooSymbol(h.symbol, h.currency, h.asset_type);
      yahooSymbols.push(ys);
      symbolMap.set(ys, h);
    }

    // Fetch quote data
    const quoteData = await fetchQuoteData(yahooSymbols);

    // Build response
    const forecasts: DividendInfo[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const [yahooSym, holding] of symbolMap) {
      const quote = quoteData[yahooSym];
      if (!quote) continue;

      const lastDiv = lastDivByHolding.get(holding.id);

      forecasts.push({
        holdingId: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        currency: holding.currency || 'USD',
        quantity: holding.quantity,
        averageCost: holding.average_cost,
        currentPrice: quote.regularMarketPrice || holding.current_price,
        exDividendDate: quote.exDividendDate,
        dividendDate: quote.dividendDate,
        dividendRate: quote.trailingAnnualDividendRate,
        dividendYield: quote.trailingAnnualDividendYield ? quote.trailingAnnualDividendYield * 100 : null,
        lastDividendValue: lastDiv?.amount ?? null,
      });
    }

    // Sort: upcoming ex-dates first, then by annual estimate
    forecasts.sort((a, b) => {
      const aDate = a.exDividendDate || '9999';
      const bDate = b.exDividendDate || '9999';
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return (b.dividendRate || 0) - (a.dividendRate || 0);
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
