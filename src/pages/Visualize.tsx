import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend } from "recharts";
import { useHoldings } from "@/hooks/useHoldings";
import { useDividends } from "@/hooks/useDividends";
import { useTransactions } from "@/hooks/useTransactions";
import { useSP500Data, calcSP500Comparison } from "@/hooks/useSP500Data";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function Visualize() {
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { dividends, isLoading: dividendsLoading } = useDividends();
  const { transactions, isLoading: txLoading } = useTransactions();
  const [showSP500, setShowSP500] = useState(true);
  const isLoading = holdingsLoading || dividendsLoading || txLoading;

  // Allocation by asset type
  const allocationMap = new Map<string, number>();
  holdings.forEach(h => {
    const value = h.quantity * h.average_cost;
    const label = { stock: "מניות", etf: "ETF", mutual_fund: "קרנות נאמנות", israeli_fund: "קרנות כספיות" }[h.asset_type] || h.asset_type;
    allocationMap.set(label, (allocationMap.get(label) || 0) + value);
  });
  const allocationData = Array.from(allocationMap.entries()).map(([name, value], i) => ({
    name, value: Math.round(value), color: COLORS[i % COLORS.length],
  }));

  // Dividends by month
  const monthMap = new Map<string, number>();
  dividends.forEach(d => {
    if (d.payment_date) {
      const date = new Date(d.payment_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + d.amount);
    }
  });
  const dividendData = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, amount]) => {
      const [y, m] = month.split('-');
      const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
      return { month: monthNames[parseInt(m) - 1], amount: Math.round(amount) };
    });

  // Performance over time: calculate cumulative invested amount per month
  const performanceData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    // Sort transactions by date
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    const firstDate = new Date(sorted[0].transaction_date);
    const now = new Date();
    
    // Group by month: cumulative investment
    const monthlyData: { date: string; invested: number; label: string }[] = [];
    let cumInvested = 0;

    // Create month buckets
    const current = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    while (current <= now) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      
      // Sum transactions in this month
      const monthTxs = sorted.filter(tx => {
        const txDate = new Date(tx.transaction_date);
        return txDate.getFullYear() === current.getFullYear() && txDate.getMonth() === current.getMonth();
      });

      for (const tx of monthTxs) {
        if (tx.transaction_type === 'buy') {
          cumInvested += tx.total_amount;
        } else if (tx.transaction_type === 'sell') {
          cumInvested -= tx.total_amount;
        }
      }

      const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
      monthlyData.push({
        date: key,
        invested: Math.round(cumInvested),
        label: `${monthNames[current.getMonth()]} ${current.getFullYear().toString().slice(2)}`,
      });

      current.setMonth(current.getMonth() + 1);
    }

    // Add current portfolio value to last entry
    if (monthlyData.length > 0) {
      const totalCurrentValue = holdings.reduce((sum, h) => {
        const price = h.current_price ?? h.average_cost;
        return sum + h.quantity * price;
      }, 0);
      monthlyData[monthlyData.length - 1] = {
        ...monthlyData[monthlyData.length - 1],
        invested: monthlyData[monthlyData.length - 1].invested,
      };
    }

    // Calculate S&P 500 relative performance (normalized to first investment)
    // Using approximate monthly returns for S&P 500 as baseline
    // We normalize: if user invested $X in month 0, S&P would have grown at ~10% annual
    if (monthlyData.length > 1) {
      const monthlyReturn = Math.pow(1.10, 1/12); // ~10% annual
      let sp500Value = monthlyData[0].invested;
      
      return monthlyData.map((d, i) => {
        if (i === 0) {
          return { ...d, sp500: d.invested };
        }
        // S&P grows the existing value + new investments get added at current value
        const prevData = monthlyData[i - 1];
        const newInvestment = d.invested - prevData.invested;
        sp500Value = sp500Value * monthlyReturn + newInvestment;
        return { ...d, sp500: Math.round(sp500Value) };
      });
    }

    return monthlyData.map(d => ({ ...d, sp500: d.invested }));
  }, [transactions, holdings]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ויזואליזציה</h1>
          <p className="text-muted-foreground">גרפים וניתוח הפורטפוליו שלך</p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Card><CardContent className="py-8"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardContent className="py-8"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
              <Card><CardContent className="py-8"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Performance Chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>ביצועי הפורטפוליו לאורך זמן</CardTitle>
                  <CardDescription>סכום מושקע מצטבר לעומת S&P 500</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="sp500-toggle" checked={showSP500} onCheckedChange={setShowSP500} />
                  <Label htmlFor="sp500-toggle" className="text-sm">השווה ל-S&P 500</Label>
                </div>
              </CardHeader>
              <CardContent>
                {performanceData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">אין עסקאות להצגה</p>
                ) : (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 11 }}
                          interval={Math.max(0, Math.floor(performanceData.length / 8))}
                        />
                        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            `$${value.toLocaleString()}`, 
                            name === 'invested' ? 'סכום מושקע' : 'S&P 500 (הערכה)'
                          ]}
                          contentStyle={{ direction: 'rtl' }}
                        />
                        <Legend formatter={(value) => value === 'invested' ? 'סכום מושקע' : 'S&P 500 (10% שנתי)'} />
                        <Line 
                          type="monotone" 
                          dataKey="invested" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2.5} 
                          dot={false}
                          name="invested"
                        />
                        {showSP500 && (
                          <Line 
                            type="monotone" 
                            dataKey="sp500" 
                            stroke="#f59e0b" 
                            strokeWidth={2} 
                            strokeDasharray="5 5"
                            dot={false}
                            name="sp500"
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>הקצאת נכסים</CardTitle>
                  <CardDescription>פיזור הפורטפוליו לפי סוג נכס</CardDescription>
                </CardHeader>
                <CardContent>
                  {allocationData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">אין נתונים להצגה</p>
                  ) : (
                    <>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                              {allocationData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'שווי']} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {allocationData.map(item => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-sm">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>דיבידנדים חודשיים</CardTitle>
                  <CardDescription>הכנסות מדיבידנדים לאורך הזמן</CardDescription>
                </CardHeader>
                <CardContent>
                  {dividendData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">אין נתונים להצגה</p>
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dividendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(v) => `$${v}`} />
                          <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'דיבידנד']} />
                          <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
