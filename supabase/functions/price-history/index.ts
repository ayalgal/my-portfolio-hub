import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { symbol, range } = await req.json();
    if (!symbol) throw new Error("Missing symbol");

    // Determine period based on range
    const now = Math.floor(Date.now() / 1000);
    let period1: number;
    let interval = "1d";

    switch (range) {
      case "1M":
        period1 = now - 30 * 86400;
        break;
      case "3M":
        period1 = now - 90 * 86400;
        break;
      case "1Y":
        period1 = now - 365 * 86400;
        break;
      case "5Y":
        period1 = now - 5 * 365 * 86400;
        interval = "1wk";
        break;
      case "ALL":
        period1 = 0;
        interval = "1mo";
        break;
      default:
        period1 = now - 365 * 86400;
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${now}&interval=${interval}`;
    
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ prices: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return new Response(JSON.stringify({ prices: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const prices = timestamps.map((t: number, i: number) => ({
      date: new Date(t * 1000).toISOString().split("T")[0],
      price: closes[i] != null ? Math.round(closes[i] * 100) / 100 : null,
    })).filter((p: any) => p.price !== null);

    return new Response(JSON.stringify({ prices }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ prices: [], error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
