import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExchangeRates {
  USDILS: number;
  CADILS: number;
  USDCAD: number;
}

const DEFAULT_RATES: ExchangeRates = {
  USDILS: 3.7,
  CADILS: 2.7,
  USDCAD: 1.37,
};

export function useExchangeRates() {
  const query = useQuery({
    queryKey: ["exchange_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*");

      if (error) throw error;

      const rates: ExchangeRates = { ...DEFAULT_RATES };
      for (const row of data || []) {
        const key = `${row.from_currency}${row.to_currency}`;
        if (key === 'USDILS') rates.USDILS = Number(row.rate);
        if (key === 'CADILS') rates.CADILS = Number(row.rate);
        if (key === 'USDCAD') rates.USDCAD = Number(row.rate);
      }
      return rates;
    },
  });

  const convertToILS = (amount: number, fromCurrency: string) => {
    const rates = query.data || DEFAULT_RATES;
    switch (fromCurrency) {
      case 'USD': return amount * rates.USDILS;
      case 'CAD': return amount * rates.CADILS;
      case 'ILS': return amount;
      default: return amount;
    }
  };

  const convertFromILS = (amountILS: number, toCurrency: string) => {
    const rates = query.data || DEFAULT_RATES;
    switch (toCurrency) {
      case 'USD': return amountILS / rates.USDILS;
      case 'CAD': return amountILS / rates.CADILS;
      case 'ILS': return amountILS;
      default: return amountILS;
    }
  };

  return {
    rates: query.data || DEFAULT_RATES,
    isLoading: query.isLoading,
    convertToILS,
    convertFromILS,
  };
}
