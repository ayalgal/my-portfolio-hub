import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend } from "recharts";
import { useHoldings } from "@/hooks/useHoldings";
import { useDividends } from "@/hooks/useDividends";
import { useTransactions } from "@/hooks/useTransactions";
import { useAllocations } from "@/hooks/useAllocations";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { useSP500Data, calcSP500Comparison } from "@/hooks/useSP500Data";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function Visualize() {
  const navigate = useNavigate();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { dividends, isLoading: dividendsLoading } = useDividends();
  const { transactions, isLoading: txLoading } = useTransactions();
  const { categories } = useAllocations();
  const { holdingCategories } = useHoldingCategories();
  const [showSP500, setShowSP500] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const isLoading = holdingsLoading || dividendsLoading || txLoading;

  // Get holding IDs for selected category
  const filteredHoldingIds = useMemo(() => {
    if (selectedCategory === "all") return null; // null means all
    const ids = holdingCategories.filter(hc => hc.category_id === selectedCategory).map(hc => hc.holding_id);
    return new Set(ids);
  }, [selectedCategory, holdingCategories]);

  const filteredHoldings = filteredHoldingIds ? holdings.filter(h => filteredHoldingIds.has(h.id)) : holdings;
  const filteredDividends = filteredHoldingIds ? dividends.filter(d => filteredHoldingIds.has(d.holding_id)) : dividends;
  const filteredTransactions = useMemo(() => {
    if (!filteredHoldingIds) return transactions || [];
    return (transactions || []).filter(t => filteredHoldingIds.has(t.holding_id));
  }, [filteredHoldingIds, transactions]);

  // Allocation by asset type
  const allocationMap = new Map<string, number>();
  filteredHoldings.forEach(h => {
    const value = h.quantity * (h.current_price ?? h.average_cost);
    const label = { stock: "מניות", etf: "ETF", mutual_fund: "קרנות נאמנות", israeli_fund: "קרנות כספיות" }[h.asset_type] || h.asset_type;
    allocationMap.set(label, (allocationMap.get(label) || 0) + value);
  });
  const allocationData = Array.from(allocationMap.entries()).map(([name, value], i) => ({
    name, value: Math.round(value), color: COLORS[i % COLORS.length],
  }));

  // Dividends by month
  const monthMap = new Map<string, number>();
  filteredDividends.forEach(d => {
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

  // Performance over time
  const investmentMonthlyData = useMemo(() => {
    if (!filteredTransactions || filteredTransactions.length === 0) return [];
    const sorted = [...filteredTransactions].sort((a, b) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    const firstDate = new Date(sorted[0].transaction_date);
    const now = new Date();
    const monthlyData: { date: string; invested: number; label: string }[] = [];
    let cumInvested = 0;
    const current = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    while (current <= now) {
      const monthTxs = sorted.filter(tx => {
        const txDate = new Date(tx.transaction_date);
        return txDate.getFullYear() === current.getFullYear() && txDate.getMonth() === current.getMonth();
      });
      for (const tx of monthTxs) {
        if (tx.transaction_type === 'buy') cumInvested += tx.total_amount;
        else if (tx.transaction_type === 'sell') cumInvested -= tx.total_amount;
      }
      const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
      monthlyData.push({
        date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
        invested: Math.round(cumInvested),
        label: `${monthNames[current.getMonth()]} ${current.getFullYear().toString().slice(2)}`,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return monthlyData;
  }, [filteredTransactions]);

  const firstTxDate = filteredTransactions?.length ? [...filteredTransactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))[0]?.transaction_date : undefined;
  const { data: sp500Data } = useSP500Data(firstTxDate);

  const performanceData = useMemo(() => {
    if (investmentMonthlyData.length === 0) return [];
    const sp500Values = calcSP500Comparison(investmentMonthlyData, sp500Data || []);
    return investmentMonthlyData.map((d, i) => ({
      ...d,
      sp500: sp500Values[i],
    }));
  }, [investmentMonthlyData, sp500Data]);

  const categorySelector = (
    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="כל התיקיות" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">כל הפורטפוליו</SelectItem>
        {categories.map(cat => (
          <SelectItem key={cat.id} value={cat.id}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cat.color || "#6b7280" }} />
              {cat.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">ויזואליזציה</h1>
            <p className="text-muted-foreground">גרפים וניתוח הפורטפוליו שלך</p>
          </div>
          {categorySelector}
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
                  <CardTitle>ביצועים לאורך זמן</CardTitle>
                  <CardDescription>
                    סכום מושקע מצטבר{selectedCategory !== "all" ? ` — ${categories.find(c => c.id === selectedCategory)?.name}` : ""} לעומת S&P 500
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="sp500-toggle" checked={showSP500} onCheckedChange={setShowSP500} />
                  <Label htmlFor="sp500-toggle" className="text-sm">S&P 500</Label>
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
                            name === 'invested' ? 'סכום מושקע' : 'S&P 500'
                          ]}
                          contentStyle={{ direction: 'rtl' }}
                        />
                        <Legend formatter={(value) => value === 'invested' ? 'סכום מושקע' : 'S&P 500'} />
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
                  <CardDescription>פיזור לפי סוג נכס</CardDescription>
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
