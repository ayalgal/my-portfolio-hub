import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";

type TimeRange = "1M" | "3M" | "1Y" | "5Y" | "ALL";
const rangeLabels: Record<TimeRange, string> = {
  "1M": "חודש",
  "3M": "רבעון",
  "1Y": "שנה",
  "5Y": "5 שנים",
  ALL: "הכל",
};

interface Props {
  holdingId: string;
  symbol: string;
  currency?: string | null;
  assetType?: string;
  currentPrice: number;
  averageCost: number;
  currencySymbol: string;
}

function getYahooSymbol(symbol: string, currency: string | null, assetType: string): string {
  if (currency === 'ILS' && assetType === 'stock' && !symbol.endsWith('.TA')) {
    return `${symbol}.TA`;
  }
  return symbol;
}

export function PriceHistoryChart({ holdingId, symbol, currency, assetType, currentPrice, averageCost, currencySymbol }: Props) {
  const [range, setRange] = useState<TimeRange>("1Y");
  const [priceData, setPriceData] = useState<{ date: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const yahooSymbol = useMemo(() => getYahooSymbol(symbol, currency || null, assetType || "stock"), [symbol, currency, assetType]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    supabase.functions
      .invoke("price-history", { body: { symbol: yahooSymbol, range } })
      .then(({ data, error: fnError }) => {
        if (cancelled) return;
        if (fnError || !data?.prices?.length) {
          setError(true);
          setPriceData([]);
        } else {
          setPriceData(data.prices);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [yahooSymbol, range]);

  const chartConfig = {
    price: { label: "מחיר", color: "hsl(var(--primary))" },
  };

  if (error && !loading && priceData.length === 0) {
    return null; // silently hide if no data
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-2">
        <CardTitle className="text-base">גרף מחיר — {symbol}</CardTitle>
        <div className="flex gap-1">
          {(Object.keys(rangeLabels) as TimeRange[]).map((r) => (
            <Button
              key={r}
              variant={r === range ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setRange(r)}
            >
              {rangeLabels[r]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : priceData.length < 2 ? (
          <p className="text-center text-muted-foreground py-8">אין נתוני מחיר היסטוריים</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <LineChart data={priceData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  if (range === "5Y" || range === "ALL") {
                    return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
                  }
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
                className="text-xs"
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${currencySymbol}${v}`}
                className="text-xs"
                width={65}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      if (payload?.[0]?.payload?.date) {
                        return new Date(payload[0].payload.date).toLocaleDateString("he-IL");
                      }
                      return "";
                    }}
                    formatter={(value) => [
                      `${currencySymbol}${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                      "מחיר",
                    ]}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
