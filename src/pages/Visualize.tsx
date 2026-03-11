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
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useSP500Data, calcSP500Comparison } from "@/hooks/useSP500Data";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

type TimeRange = "6m" | "1y" | "2y" | "5y" | "all";
type PieMode = "category" | "assetType";

export default function Visualize() {
  const navigate = useNavigate();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { dividends, isLoading: dividendsLoading } = useDividends();
  const { transactions, isLoading: txLoading } = useTransactions();
  const { categories } = useAllocations();
  const { holdingCategories } = useHoldingCategories();
  const { convertToILS, convertFromILS } = useExchangeRates();
  const [showSP500, setShowSP500] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [pieMode, setPieMode] = useState<PieMode>("category");
  const [selectedDivYear, setSelectedDivYear] = useState<number>(new Date().getFullYear());
  const isLoading = holdingsLoading || dividendsLoading || txLoading;

  // Get holding IDs for selected category
  const filteredHoldingIds = useMemo(() => {
    if (selectedCategory === "all") return null;
    const ids = holdingCategories.filter(hc => hc.category_id === selectedCategory).map(hc => hc.holding_id);
    return new Set(ids);
  }, [selectedCategory, holdingCategories]);

  const filteredHoldings = filteredHoldingIds ? holdings.filter(h => filteredHoldingIds.has(h.id)) : holdings;
  const filteredDividends = filteredHoldingIds ? dividends.filter(d => filteredHoldingIds.has(d.holding_id)) : dividends;
  const filteredTransactions = useMemo(() => {
    if (!filteredHoldingIds) return transactions || [];
    return (transactions || []).filter(t => filteredHoldingIds.has(t.holding_id));
  }, [filteredHoldingIds, transactions]);

  // Allocation by category (default) or asset type
  const allocationData = useMemo(() => {
    if (pieMode === "category") {
      const catMap = new Map<string, { name: string; value: number; color: string }>();
      const categorizedIds = new Set<string>();
      
      for (const cat of categories) {
        const catHoldingIds = holdingCategories.filter(hc => hc.category_id === cat.id).map(hc => hc.holding_id);
        const catHoldings = filteredHoldings.filter(h => catHoldingIds.includes(h.id));
        const value = catHoldings.reduce((s, h) => {
          const val = h.quantity * (h.current_price ?? h.average_cost);
          return s + convertFromILS(convertToILS(val, h.currency || "ILS"), "USD");
        }, 0);
        if (value > 0) {
          catMap.set(cat.id, { name: cat.name, value: Math.round(value), color: cat.color || COLORS[catMap.size % COLORS.length] });
        }
        catHoldingIds.forEach(id => categorizedIds.add(id));
      }

      const uncatValue = filteredHoldings
        .filter(h => !categorizedIds.has(h.id))
        .reduce((s, h) => {
          const val = h.quantity * (h.current_price ?? h.average_cost);
          return s + convertFromILS(convertToILS(val, h.currency || "ILS"), "USD");
        }, 0);
      if (uncatValue > 0) {
        catMap.set("uncat", { name: "ללא קטגוריה", value: Math.round(uncatValue), color: "#d1d5db" });
      }
      return Array.from(catMap.values());
    } else {
      const typeMap = new Map<string, number>();
      filteredHoldings.forEach(h => {
        const value = h.quantity * (h.current_price ?? h.average_cost);
        const valueUSD = convertFromILS(convertToILS(value, h.currency || "ILS"), "USD");
        const label = { stock: "מניות", etf: "ETF", mutual_fund: "קרנות נאמנות", israeli_fund: "קרנות כספיות", bank_savings: "חסכונות", cash: "מזומן" }[h.asset_type] || h.asset_type;
        typeMap.set(label, (typeMap.get(label) || 0) + valueUSD);
      });
      return Array.from(typeMap.entries()).map(([name, value], i) => ({
        name, value: Math.round(value), color: COLORS[i % COLORS.length],
      }));
    }
  }, [filteredHoldings, categories, holdingCategories, pieMode, convertToILS, convertFromILS]);

  const totalPieValue = allocationData.reduce((s, d) => s + d.value, 0);

  // Dividends by year with YoY comparison
  const dividendYears = useMemo(() => {
    const years = new Set<number>();
    filteredDividends.forEach(d => { if (d.payment_date) years.add(new Date(d.payment_date).getFullYear()); });
    return Array.from(years).sort((a, b) => b - a);
  }, [filteredDividends]);

  const dividendData = useMemo(() => {
    const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
    const result = monthNames.map((name, i) => ({
      month: name,
      current: 0,
      prevYear: 0,
    }));
    filteredDividends.forEach(d => {
      if (!d.payment_date) return;
      const date = new Date(d.payment_date);
      const amount = convertFromILS(convertToILS(d.amount, d.currency || "ILS"), "USD");
      if (date.getFullYear() === selectedDivYear) {
        result[date.getMonth()].current += amount;
      } else if (date.getFullYear() === selectedDivYear - 1) {
        result[date.getMonth()].prevYear += amount;
      }
    });
    return result.map(r => ({ ...r, current: Math.round(r.current), prevYear: Math.round(r.prevYear) }));
  }, [filteredDividends, selectedDivYear, convertToILS, convertFromILS]);

  // Performance over time with time range filtering
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
    const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
    while (current <= now) {
      const monthTxs = sorted.filter(tx => {
        const txDate = new Date(tx.transaction_date);
        return txDate.getFullYear() === current.getFullYear() && txDate.getMonth() === current.getMonth();
      });
      for (const tx of monthTxs) {
        if (tx.transaction_type === 'buy') cumInvested += tx.total_amount;
        else if (tx.transaction_type === 'sell') cumInvested -= tx.total_amount;
      }
      monthlyData.push({
        date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
        invested: Math.round(cumInvested),
        label: `${monthNames[current.getMonth()]} ${current.getFullYear().toString().slice(2)}`,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return monthlyData;
  }, [filteredTransactions]);

  // Apply time range filter
  const filteredMonthlyData = useMemo(() => {
    if (timeRange === "all") return investmentMonthlyData;
    const now = new Date();
    const months = { "6m": 6, "1y": 12, "2y": 24, "5y": 60 }[timeRange];
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return investmentMonthlyData.filter(d => new Date(d.date + "-01") >= cutoff);
  }, [investmentMonthlyData, timeRange]);

  const firstTxDate = filteredTransactions?.length ? [...filteredTransactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))[0]?.transaction_date : undefined;
  const { data: sp500Data } = useSP500Data(firstTxDate);

  const performanceData = useMemo(() => {
    if (filteredMonthlyData.length === 0) return [];
    // Recalculate S&P from the full data, then slice
    const allSP500 = calcSP500Comparison(investmentMonthlyData, sp500Data || []);
    const startIdx = investmentMonthlyData.length - filteredMonthlyData.length;
    return filteredMonthlyData.map((d, i) => ({
      ...d,
      sp500: allSP500[startIdx + i],
    }));
  }, [filteredMonthlyData, investmentMonthlyData, sp500Data]);

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

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload?.[0]) {
      const data = payload[0].payload;
      const pct = totalPieValue > 0 ? (data.value / totalPieValue) * 100 : 0;
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="font-medium text-sm">{data.name}</p>
          <p className="text-sm text-muted-foreground">${data.value.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{pct.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

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
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>ביצועים לאורך זמן</CardTitle>
                  <CardDescription>
                    סכום מושקע מצטבר{selectedCategory !== "all" ? ` — ${categories.find(c => c.id === selectedCategory)?.name}` : ""} לעומת S&P 500
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="6m" className="text-xs h-6 px-2">6 חודשים</TabsTrigger>
                      <TabsTrigger value="1y" className="text-xs h-6 px-2">שנה</TabsTrigger>
                      <TabsTrigger value="2y" className="text-xs h-6 px-2">שנתיים</TabsTrigger>
                      <TabsTrigger value="5y" className="text-xs h-6 px-2">5 שנים</TabsTrigger>
                      <TabsTrigger value="all" className="text-xs h-6 px-2">הכל</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex items-center gap-2">
                    <Switch id="sp500-toggle" checked={showSP500} onCheckedChange={setShowSP500} />
                    <Label htmlFor="sp500-toggle" className="text-sm">S&P 500</Label>
                  </div>
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>הקצאת נכסים</CardTitle>
                    <CardDescription>פיזור לפי {pieMode === "category" ? "תיקייה" : "סוג נכס"}</CardDescription>
                  </div>
                  <Tabs value={pieMode} onValueChange={(v) => setPieMode(v as PieMode)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="category" className="text-xs h-6 px-2">תיקייה</TabsTrigger>
                      <TabsTrigger value="assetType" className="text-xs h-6 px-2">סוג נכס</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>
                <CardContent>
                  {allocationData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">אין נתונים להצגה</p>
                  ) : (
                    <>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                              {allocationData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip content={<CustomPieTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {allocationData.map(item => {
                          const pct = totalPieValue > 0 ? (item.value / totalPieValue) * 100 : 0;
                          return (
                            <div key={item.name} className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-sm">{item.name} ({pct.toFixed(0)}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle>דיבידנדים חודשיים</CardTitle>
                    <CardDescription>השוואה שנתית — {selectedDivYear} מול {selectedDivYear - 1}</CardDescription>
                  </div>
                  {dividendYears.length > 0 && (
                    <div className="flex items-center gap-1">
                      {dividendYears.map(y => (
                        <Button key={y} variant={y === selectedDivYear ? "default" : "ghost"} size="sm" onClick={() => setSelectedDivYear(y)}>
                          {y}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {dividendData.every(d => d.current === 0 && d.prevYear === 0) ? (
                    <p className="text-center text-muted-foreground py-12">אין נתונים להצגה</p>
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dividendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(v) => `$${v}`} />
                          <Tooltip formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === 'current' ? `${selectedDivYear}` : `${selectedDivYear - 1}`]} />
                          <Legend formatter={(value) => value === 'current' ? `${selectedDivYear}` : `${selectedDivYear - 1}`} />
                          <Bar dataKey="current" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="current" />
                          <Bar dataKey="prevYear" fill="#94a3b8" radius={[4, 4, 0, 0]} name="prevYear" />
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
