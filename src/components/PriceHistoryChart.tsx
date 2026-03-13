import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useTransactions } from "@/hooks/useTransactions";

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
  currentPrice: number;
  averageCost: number;
  currencySymbol: string;
}

export function PriceHistoryChart({ holdingId, currentPrice, averageCost, currencySymbol }: Props) {
  const [range, setRange] = useState<TimeRange>("1Y");
  const { transactions } = useTransactions(holdingId);

  const chartData = useMemo(() => {
    // Build price points from transactions + current price
    const now = new Date();
    const cutoff = new Date();
    if (range === "1M") cutoff.setMonth(now.getMonth() - 1);
    else if (range === "3M") cutoff.setMonth(now.getMonth() - 3);
    else if (range === "1Y") cutoff.setFullYear(now.getFullYear() - 1);
    else if (range === "5Y") cutoff.setFullYear(now.getFullYear() - 5);
    else cutoff.setFullYear(2000);

    const points: { date: string; price: number }[] = [];
    
    // Add transaction price points
    const buyTxs = transactions
      .filter((tx: any) => (tx.transaction_type === "buy" || tx.transaction_type === "sell") && tx.price > 0)
      .sort((a: any, b: any) => a.transaction_date.localeCompare(b.transaction_date));

    for (const tx of buyTxs) {
      const txDate = new Date(tx.transaction_date);
      if (txDate >= cutoff) {
        points.push({ date: tx.transaction_date, price: tx.price });
      }
    }

    // Add current price as the latest point
    if (currentPrice > 0) {
      points.push({ date: now.toISOString().split("T")[0], price: currentPrice });
    }

    // If no transaction data, create a simple line from avg cost to current
    if (points.length < 2 && averageCost > 0 && currentPrice > 0) {
      const startDate = new Date(cutoff);
      if (startDate < new Date("2020-01-01")) startDate.setFullYear(2020);
      return [
        { date: startDate.toISOString().split("T")[0], price: averageCost },
        { date: now.toISOString().split("T")[0], price: currentPrice },
      ];
    }

    return points;
  }, [transactions, currentPrice, averageCost, range]);

  const chartConfig = {
    price: { label: "מחיר", color: "hsl(var(--primary))" },
  };

  if (chartData.length < 2) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-2">
        <CardTitle className="text-base">גרף מחיר</CardTitle>
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
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
              className="text-xs"
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v) => `${currencySymbol}${v}`}
              className="text-xs"
              width={60}
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
                  formatter={(value) => [`${currencySymbol}${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "מחיר"]}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={chartData.length <= 20}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
