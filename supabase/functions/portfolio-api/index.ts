import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch holdings
    const { data: holdings } = await supabase
      .from("holdings")
      .select("id, symbol, name, asset_type, quantity, average_cost, current_price, currency, fund_number");

    // Fetch dividends
    const { data: dividends } = await supabase
      .from("dividends")
      .select("id, holding_id, amount, currency, payment_date, ex_date, tax_withheld, is_israeli, shares_at_payment");

    // Fetch categories
    const { data: categories } = await supabase
      .from("allocation_categories")
      .select("id, name, target_percentage, color");

    // Fetch holding-category links
    const { data: holdingCategories } = await supabase
      .from("holding_categories")
      .select("holding_id, category_id");

    // Fetch recent transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, holding_id, transaction_type, quantity, price, total_amount, currency, transaction_date")
      .order("transaction_date", { ascending: false })
      .limit(100);

    // Build summary
    const totalValue = (holdings || []).reduce((sum, h) => {
      const price = h.current_price ?? h.average_cost;
      return sum + h.quantity * price;
    }, 0);

    const totalCost = (holdings || []).reduce((sum, h) => sum + h.quantity * h.average_cost, 0);

    const totalDividends = (dividends || []).reduce((sum, d) => sum + d.amount, 0);
    const totalTax = (dividends || []).reduce((sum, d) => sum + (d.tax_withheld || 0), 0);

    const portfolio = {
      summary: {
        total_value: totalValue,
        total_cost: totalCost,
        unrealized_pnl: totalValue - totalCost,
        total_dividends_gross: totalDividends,
        total_dividends_tax: totalTax,
        total_dividends_net: totalDividends - totalTax,
        total_return: (totalValue - totalCost) + (totalDividends - totalTax),
        holdings_count: (holdings || []).filter(h => h.quantity > 0).length,
      },
      holdings: (holdings || []).filter(h => h.quantity > 0).map(h => {
        const price = h.current_price ?? h.average_cost;
        const holdingDivs = (dividends || []).filter(d => d.holding_id === h.id);
        const divGross = holdingDivs.reduce((s, d) => s + d.amount, 0);
        const divTax = holdingDivs.reduce((s, d) => s + (d.tax_withheld || 0), 0);
        const cats = (holdingCategories || []).filter(hc => hc.holding_id === h.id);
        const catNames = cats.map(c => (categories || []).find(cat => cat.id === c.category_id)?.name).filter(Boolean);

        return {
          symbol: h.symbol,
          name: h.name,
          asset_type: h.asset_type,
          quantity: h.quantity,
          average_cost: h.average_cost,
          current_price: h.current_price,
          currency: h.currency,
          value: h.quantity * price,
          cost: h.quantity * h.average_cost,
          unrealized_pnl: h.quantity * price - h.quantity * h.average_cost,
          dividends_gross: divGross,
          dividends_net: divGross - divTax,
          total_return: (h.quantity * price - h.quantity * h.average_cost) + (divGross - divTax),
          categories: catNames,
          last_dividend: holdingDivs.sort((a, b) => (b.payment_date || "").localeCompare(a.payment_date || ""))[0] || null,
        };
      }),
      categories: (categories || []).map(cat => {
        const linkedIds = (holdingCategories || []).filter(hc => hc.category_id === cat.id).map(hc => hc.holding_id);
        const catHoldings = (holdings || []).filter(h => linkedIds.includes(h.id) && h.quantity > 0);
        const value = catHoldings.reduce((s, h) => s + h.quantity * (h.current_price ?? h.average_cost), 0);
        return {
          name: cat.name,
          target_percentage: cat.target_percentage,
          holdings_count: catHoldings.length,
          value,
        };
      }),
      recent_transactions: transactions || [],
      generated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(portfolio), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("portfolio-api error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
