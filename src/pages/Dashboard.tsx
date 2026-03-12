import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon, Plus, ArrowUpLeft, ArrowDownRight, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useHoldings } from "@/hooks/useHoldings";
import { useDividends } from "@/hooks/useDividends";
import { useTransactions } from "@/hooks/useTransactions";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useAllocations } from "@/hooks/useAllocations";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSP500Data, calcSP500Comparison } from "@/hooks/useSP500Data";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AddHoldingDialog } from "@/components/AddHoldingDialog";
import { UpdateSavingsDialog } from "@/components/UpdateSavingsDialog";

type DisplayCurrency = 'ILS' | 'USD' | 'CAD';

const currencySymbols: Record<DisplayCurrency, string> = {
  ILS: '₪',
  USD: '$',
  CAD: 'C$',
};

export default function Dashboard() {
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { dividends, isLoading: dividendsLoading } = useDividends();
  const { transactions, isLoading: txLoading } = useTransactions();
  const { profile } = useProfile();
  const { convertToILS, convertFromILS, isLoading: ratesLoading } = useExchangeRates();
  const { categories } = useAllocations();
  const { holdingCategories } = useHoldingCategories();
  const { portfolios } = usePortfolio();
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('USD');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showSP500, setShowSP500] = useState(true);
  const [selectedDivYear, setSelectedDivYear] = useState<number>(new Date().getFullYear());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [savingsToUpdate, setSavingsToUpdate] = useState<typeof holdings[0] | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Monthly reminder for bank savings updates
  useEffect(() => {
    if (holdings.length === 0) return;
    const bankSavings = holdings.filter(h => h.asset_type === 'bank_savings' && h.quantity > 0);
    const stale = bankSavings.filter(h => {
      const updated = h.updated_at || h.created_at;
      if (!updated) return true;
      const daysSinceUpdate = (Date.now() - new Date(updated).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate >= 30;
    });
    if (stale.length > 0) {
      toast({
        title: "תזכורת: עדכן חסכונות בנקאיים",
        description: `${stale.map(s => s.name).join(", ")} לא עודכנו מעל חודש`,
        duration: 10000,
      });
    }
  }, [holdings]);

  const isLoading = holdingsLoading || dividendsLoading || ratesLoading;

  const formatAmount = (amountILS: number) => {
    const converted = convertFromILS(amountILS, displayCurrency);
    return `${currencySymbols[displayCurrency]}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  // Calculate totals
  const totalCostILS = holdings.reduce((sum, h) => {
    const costInOrigCurrency = h.quantity * h.average_cost;
    return sum + convertToILS(costInOrigCurrency, h.currency || 'ILS');
  }, 0);

  const totalValueILS = holdings.reduce((sum, h) => {
    const price = h.current_price ?? h.average_cost;
    const valueInOrigCurrency = h.quantity * price;
    return sum + convertToILS(valueInOrigCurrency, h.currency || 'ILS');
  }, 0);

  const totalGainILS = totalValueILS - totalCostILS;
  const totalGainPercent = totalCostILS > 0 ? (totalGainILS / totalCostILS) * 100 : 0;

  const totalDividendsILS = dividends.reduce((sum, d) => {
    return sum + convertToILS(d.amount, d.currency || 'ILS');
  }, 0);

  const displayName = profile?.display_name || "";
  const hasCurrentPrices = holdings.some(h => h.current_price !== null);

  // Allocation data
  const getCategoryHoldings = (categoryId: string) => {
    const linkedIds = holdingCategories.filter(hc => hc.category_id === categoryId).map(hc => hc.holding_id);
    return holdings.filter(h => linkedIds.includes(h.id));
  };

  const getHoldingValueUSD = (h: any) => {
    const val = h.quantity * (h.current_price ?? h.average_cost);
    return convertFromILS(convertToILS(val, h.currency || "ILS"), "USD");
  };

  const totalPortfolioUSD = holdings.reduce((sum, h) => sum + getHoldingValueUSD(h), 0);

  const categoryData = categories.map((cat) => {
    const catHoldings = getCategoryHoldings(cat.id);
    const valueUSD = catHoldings.reduce((s, h) => s + getHoldingValueUSD(h), 0);
    const actualPct = totalPortfolioUSD > 0 ? (valueUSD / totalPortfolioUSD) * 100 : 0;
    return { ...cat, holdings: catHoldings, valueUSD, actualPct };
  }).filter(c => c.valueUSD > 0);

  const pieData = categoryData.map(c => ({
    name: c.name,
    value: c.valueUSD,
    color: c.color || "#8b5cf6",
  }));

  // Performance chart data
  const investmentMonthlyData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const sorted = [...transactions].sort((a, b) =>
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
  }, [transactions]);

  const firstTxDate = transactions?.length ? [...transactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))[0]?.transaction_date : undefined;
  const { data: sp500Data } = useSP500Data(firstTxDate);

  const performanceData = useMemo(() => {
    if (investmentMonthlyData.length === 0) return [];
    const sp500Values = calcSP500Comparison(investmentMonthlyData, sp500Data || []);
    return investmentMonthlyData.map((d, i) => ({
      ...d,
      sp500: sp500Values[i],
    }));
  }, [investmentMonthlyData, sp500Data]);

  // Available years for dividends
  const dividendYears = useMemo(() => {
    const years = new Set<number>();
    dividends.forEach(d => {
      if (d.payment_date) years.add(new Date(d.payment_date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [dividends]);

  // Dividends by month for selected year
  const dividendData = useMemo(() => {
    const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
    // Initialize all 12 months
    const result = monthNames.map((name, i) => ({
      month: name,
      monthKey: `${selectedDivYear}-${String(i + 1).padStart(2, '0')}`,
      gross: 0,
      net: 0,
      prevYearNet: 0,
    }));
    dividends.forEach(d => {
      if (d.payment_date) {
        const date = new Date(d.payment_date);
        const monthIdx = date.getMonth();
        const amountILS = convertToILS(d.amount, d.currency || 'ILS');
        const taxILS = convertToILS(d.tax_withheld || 0, d.currency || 'ILS');
        const grossC = convertFromILS(amountILS, displayCurrency);
        const netC = convertFromILS(amountILS - taxILS, displayCurrency);
        if (date.getFullYear() === selectedDivYear) {
          result[monthIdx].gross += grossC;
          result[monthIdx].net += netC;
        } else if (date.getFullYear() === selectedDivYear - 1) {
          result[monthIdx].prevYearNet += netC;
        }
      }
    });
    return result.map(r => ({ ...r, gross: Math.round(r.gross), net: Math.round(r.net), prevYearNet: Math.round(r.prevYearNet) }));
  }, [dividends, convertToILS, convertFromILS, displayCurrency, selectedDivYear]);

  // YoY comparison
  const currentYearTotal = dividendData.reduce((s, d) => s + d.net, 0);
  const prevYearTotal = dividendData.reduce((s, d) => s + d.prevYearNet, 0);
  const yoyChange = prevYearTotal > 0 ? ((currentYearTotal - prevYearTotal) / prevYearTotal) * 100 : 0;

  const handleRefreshPrices = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-prices');
      if (error) throw error;
      const msg = data?.dividendsAdded ? `עודכנו ${data.updated} מחירים, נוספו ${data.dividendsAdded} דיבידנדים` : `עודכנו ${data?.updated || 0} מחירים`;
      toast({ title: "מחירים עודכנו", description: msg });
      window.location.reload();
    } catch {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן לעדכן מחירים" });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Reset moved to Settings page

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">שלום {displayName}! 👋</h1>
            <p className="text-muted-foreground">סקירה כללית של הפורטפוליו שלך</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Tabs value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}>
              <TabsList>
                <TabsTrigger value="ILS">₪ שקל</TabsTrigger>
                <TabsTrigger value="USD">$ דולר</TabsTrigger>
                <TabsTrigger value="CAD">C$ קנדי</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon" onClick={handleRefreshPrices} disabled={isRefreshing} title="עדכן מחירים">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />הוסף נייר ערך
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">שווי כולל</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold">{formatAmount(totalValueILS)}</div>
                  <p className="text-xs text-muted-foreground">עלות: {formatAmount(totalCostILS)}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">רווח/הפסד (הון)</CardTitle>
              {totalGainILS >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className={`text-2xl font-bold ${totalGainILS >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalGainILS >= 0 ? '+' : ''}{formatAmount(totalGainILS)}
                  </div>
                  <p className={`text-xs ${totalGainPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
                  </p>
                  {totalDividendsILS > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      כולל דיבידנדים: <span className={(totalGainILS + totalDividendsILS) >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {(totalGainILS + totalDividendsILS) >= 0 ? '+' : ''}{formatAmount(totalGainILS + totalDividendsILS)}
                      </span>
                    </p>
                  )}
                  {!hasCurrentPrices && holdings.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">לחץ ↻ לעדכון מחירים</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">דיבידנדים</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-blue-500">{formatAmount(totalDividendsILS)}</div>
                  <p className="text-xs text-muted-foreground">מ-{dividends.length} תשלומים</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ניירות ערך</CardTitle>
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold">{holdings.length}</div>
                  <p className="text-xs text-muted-foreground">בפורטפוליו</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Allocation Pie Chart Section */}
        {holdings.length > 0 && categoryData.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>הקצאות</CardTitle>
                <CardDescription>התפלגות הפורטפוליו לפי תיקיות</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/allocations"><ExternalLink className="ml-2 h-3 w-3" />ניהול מלא</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" stroke="none">
                        {pieData.map((entry, idx) => (<Cell key={idx} fill={entry.color} />))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'שווי']} contentStyle={{ direction: 'rtl' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {categoryData.map((cat) => (
                    <div key={cat.id}>
                      <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-right" onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || "#8b5cf6" }} />
                          <span className="font-medium hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/category/${cat.id}`); }}>{cat.name}</span>
                          <span className="text-xs text-muted-foreground">({cat.holdings.length})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold" dir="ltr">${cat.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          <span className="text-xs text-muted-foreground">{cat.actualPct.toFixed(1)}%</span>
                          {expandedCategory === cat.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>
                      {expandedCategory === cat.id && (
                        <div className="mr-6 space-y-1 pb-2">
                          {cat.holdings.map(h => (
                            <button key={h.id} className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-muted/30 text-sm text-right" onClick={() => navigate(`/holding/${h.id}`)}>
                              <span>{h.name} <span className="text-muted-foreground">({h.symbol})</span></span>
                              <span dir="ltr" className="text-muted-foreground">${getHoldingValueUSD(h).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance & Dividends Charts */}
        {holdings.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>ביצועים לאורך זמן</CardTitle>
                  <CardDescription>סכום מושקע מצטבר</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="sp500" checked={showSP500} onCheckedChange={setShowSP500} />
                  <Label htmlFor="sp500" className="text-xs">S&P 500</Label>
                </div>
              </CardHeader>
              <CardContent>
                {performanceData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">אין עסקאות להצגה</p>
                ) : (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(performanceData.length / 6))} />
                        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === 'invested' ? 'מושקע' : 'S&P 500']} contentStyle={{ direction: 'rtl' }} />
                        <Legend formatter={(value) => value === 'invested' ? 'מושקע' : 'S&P 500'} />
                        <Line type="monotone" dataKey="invested" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="invested" />
                        {showSP500 && <Line type="monotone" dataKey="sp500" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="sp500" />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dividends Chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>דיבידנדים חודשיים</CardTitle>
                  <CardDescription>
                    הכנסות מדיבידנדים — לחץ על חודש לפירוט
                    {prevYearTotal > 0 && (
                      <span className={`mr-2 font-semibold ${yoyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ({yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}% מול {selectedDivYear - 1})
                      </span>
                    )}
                  </CardDescription>
                </div>
                {dividendYears.length > 1 && (
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
                {dividendData.every(d => d.gross === 0) ? (
                  <p className="text-center text-muted-foreground py-12">אין דיבידנדים ב-{selectedDivYear} — לחץ ↻ לעדכון</p>
                ) : (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dividendData} onClick={(data) => {
                        if (data?.activePayload?.[0]?.payload?.monthKey) {
                          navigate(`/dividends?month=${data.activePayload[0].payload.monthKey}`);
                        }
                      }} style={{ cursor: 'pointer' }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => `${currencySymbols[displayCurrency]}${v}`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value: number, name: string) => [`${currencySymbols[displayCurrency]}${value.toLocaleString()}`, name === 'gross' ? 'ברוטו' : 'נטו (אחרי מס)']} contentStyle={{ direction: 'rtl' }} />
                        <Legend formatter={(value) => value === 'gross' ? 'ברוטו' : 'נטו (אחרי מס)'} />
                        <Bar dataKey="gross" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="gross" />
                        <Bar dataKey="net" fill="#22c55e" radius={[4, 4, 0, 0]} name="net" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {holdings.length === 0 && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>התחל עם הפורטפוליו שלך</CardTitle>
                <CardDescription>הוסף את ניירות הערך הראשונים שלך או ייבא נתונים מקובץ</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button asChild><Link to="/invest"><Plus className="ml-2 h-4 w-4" />הוסף ידנית</Link></Button>
                <Button variant="outline" asChild><Link to="/import"><ArrowUpLeft className="ml-2 h-4 w-4" />ייבא קובץ</Link></Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>הגדר יעדי השקעה</CardTitle>
                <CardDescription>הגדר יעדים וטרגטים למעקב אחר ההתקדמות שלך</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild><Link to="/goals">הגדר יעדים</Link></Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <AddHoldingDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <UpdateSavingsDialog open={!!savingsToUpdate} onOpenChange={(o) => !o && setSavingsToUpdate(null)} holding={savingsToUpdate} />
    </AppLayout>
  );
}
