import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SP500DataPoint {
  date: string;
  close: number;
}

export function useSP500Data(fromDate?: string) {
  return useQuery({
    queryKey: ["sp500-data", fromDate],
    queryFn: async () => {
      if (!fromDate) return [];
      const { data, error } = await supabase.functions.invoke("sp500-data", {
        body: { from: fromDate, to: new Date().toISOString().split("T")[0] },
      });
      if (error) throw error;
      return (data?.data || []) as SP500DataPoint[];
    },
    enabled: !!fromDate,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Given monthly investment data and S&P 500 price data, 
 * calculate what the portfolio would be worth if invested in S&P 500 instead.
 */
export function calcSP500Comparison(
  monthlyData: { date: string; invested: number }[],
  sp500Data: SP500DataPoint[]
): number[] {
  if (sp500Data.length === 0 || monthlyData.length === 0) return monthlyData.map(d => d.invested);

  const sp500Map = new Map(sp500Data.map(d => [d.date, d.close]));
  
  // For each month, track how many "S&P units" were bought
  let totalUnits = 0;
  const result: number[] = [];

  for (let i = 0; i < monthlyData.length; i++) {
    const d = monthlyData[i];
    const sp500Price = sp500Map.get(d.date);
    
    if (!sp500Price) {
      // Find closest price
      const closest = sp500Data.reduce((best, p) => {
        const diff = Math.abs(new Date(p.date).getTime() - new Date(d.date).getTime());
        const bestDiff = Math.abs(new Date(best.date).getTime() - new Date(d.date).getTime());
        return diff < bestDiff ? p : best;
      }, sp500Data[0]);
      
      if (i > 0) {
        const newInvestment = d.invested - monthlyData[i - 1].invested;
        if (newInvestment !== 0 && closest.close > 0) {
          totalUnits += newInvestment / closest.close;
        }
      } else {
        if (d.invested > 0 && closest.close > 0) {
          totalUnits = d.invested / closest.close;
        }
      }
      result.push(Math.round(totalUnits * closest.close));
      continue;
    }

    if (i === 0) {
      if (d.invested > 0 && sp500Price > 0) {
        totalUnits = d.invested / sp500Price;
      }
    } else {
      const newInvestment = d.invested - monthlyData[i - 1].invested;
      if (newInvestment !== 0 && sp500Price > 0) {
        totalUnits += newInvestment / sp500Price;
      }
    }
    result.push(Math.round(totalUnits * sp500Price));
  }

  return result;
}
