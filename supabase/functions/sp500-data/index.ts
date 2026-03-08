import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { from, to } = await req.json();
    
    // Fetch S&P 500 (^GSPC) monthly data from Yahoo Finance
    const fromTs = Math.floor(new Date(from).getTime() / 1000);
    const toTs = Math.floor(new Date(to).getTime() / 1000);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${fromTs}&period2=${toTs}&interval=1mo`;
    
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`);
    }
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result?.timestamp || !result?.indicators?.quote?.[0]?.close) {
      throw new Error("No data from Yahoo Finance");
    }
    
    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    
    const monthlyData = timestamps.map((ts: number, i: number) => {
      const date = new Date(ts * 1000);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { date: key, close: closes[i] ? Math.round(closes[i] * 100) / 100 : null };
    }).filter((d: any) => d.close !== null);
    
    return new Response(JSON.stringify({ data: monthlyData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
