import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Pencil, ExternalLink } from "lucide-react";
import { useAllocations } from "@/hooks/useAllocations";
import { useHoldings } from "@/hooks/useHoldings";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { useDividends } from "@/hooks/useDividends";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useTransactions } from "@/hooks/useTransactions";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useSP500Data, calcSP500Comparison } from "@/hooks/useSP500Data";
import { Switch } from "@/components/ui/switch";

const getCurrencySymbol = (c: string) => ({ ILS: "₪", USD: "$", CAD: "C$", EUR: "€" }[c] || c);

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { categories, updateCategory, isLoading: catLoading } = useAllocations();
  const { portfolios } = usePortfolio();
  const { holdings } = useHoldings(portfolios?.[0]?.id);
  const { holdingCategories } = useHoldingCategories();
  const { dividends } = useDividends();
  const { transactions } = useTransactions();
  const { convertToILS, convertFromILS } = useExchangeRates();
  const [editOpen, setEditOpen] = useState(false);
  const [showSP500, setShowSP500] = useState(true);

  const category = categories.find(c => c.id === id);

  const catHoldingIds = holdingCategories.filter(hc => hc.category_id === id).map(hc => hc.holding_id);
  const catHoldings = holdings.filter(h => catHoldingIds.includes(h.id));

  // Dividends for this category's holdings
  const catDividends = dividends.filter(d => catHoldingIds.includes(d.holding_id));
  const totalDivGross = catDividends.reduce((s, d) => s + convertToILS(d.amount, d.currency || "ILS"), 0);
  const totalDivTax = catDividends.reduce((s, d) => s + convertToILS(d.tax_withheld || 0, d.currency || "ILS"), 0);
  const totalDivNet = totalDivGross - totalDivTax;

  // Per-holding dividend net
  const holdingDivNet = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of catDividends) {
      const netILS = convertToILS(d.amount - (d.tax_withheld || 0), d.currency || "ILS");
      map.set(d.holding_id, (map.get(d.holding_id) || 0) + netILS);
    }
    return map;
  }, [catDividends, convertToILS]);

  const totalValue = catHoldings.reduce((s, h) => {
    const price = h.current_price ?? h.average_cost;
    return s + convertToILS(h.quantity * price, h.currency || "ILS");
  }, 0);

  const totalCost = catHoldings.reduce((s, h) => s + convertToILS(h.quantity * h.average_cost, h.currency || "ILS"), 0);
  const pricePnl = totalValue - totalCost;
  const totalPnl = pricePnl + totalDivNet; // Total return = price P&L + dividends net

  // Default currency: USD for non-Israeli, ILS for Israeli
  const isIsraeliCategory = catHoldings.every(h => h.currency === "ILS" || h.asset_type === "israeli_fund");
  const defaultCurr = isIsraeliCategory ? "ILS" : "USD";
  const cs = getCurrencySymbol(defaultCurr);
  const toDisplay = (ilsAmount: number) => convertFromILS(ilsAmount, defaultCurr);
  const fmtD = (ilsAmount: number) => `${cs}${toDisplay(ilsAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // Performance chart
  const catTransactions = useMemo(() => {
    return (transactions || []).filter(t => catHoldingIds.includes(t.holding_id));
  }, [transactions, catHoldingIds]);

  const investmentMonthlyData = useMemo(() => {
    if (catTransactions.length === 0) return [];
    const sorted = [...catTransactions].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
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
  }, [catTransactions]);

  const firstTxDate = catTransactions.length ? [...catTransactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))[0]?.transaction_date : undefined;
  const { data: sp500Data } = useSP500Data(firstTxDate);

  const performanceData = useMemo(() => {
    if (investmentMonthlyData.length === 0) return [];
    const sp500Values = calcSP500Comparison(investmentMonthlyData, sp500Data || []);
    return investmentMonthlyData.map((d, i) => ({ ...d, sp500: sp500Values[i] }));
  }, [investmentMonthlyData, sp500Data]);

  if (catLoading) {
    return <AppLayout><Skeleton className="h-64 w-full" /></AppLayout>;
  }

  if (!category) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-xl font-semibold mb-4">קטגוריה לא נמצאה</h2>
          <Button onClick={() => navigate("/allocations")}><ArrowRight className="ml-2 h-4 w-4" />חזרה להקצאות</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/allocations")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: category.color || "#6b7280" }} />
            <h1 className="text-3xl font-bold">{category.name}</h1>
            {category.target_percentage ? (
              <Badge variant="outline">יעד {category.target_percentage}%</Badge>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 ml-1" />עריכה
          </Button>
        </div>

        {/* Stats — includes dividends in total P&L */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">ניירות ערך</p>
              <p className="text-2xl font-bold">{catHoldings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">עלות מקורית</p>
              <p className="text-2xl font-bold" dir="ltr">{fmtD(totalCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">שווי כולל</p>
              <p className="text-2xl font-bold" dir="ltr">{fmtD(totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">רווח/הפסד כולל</p>
              <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`} dir="ltr">
                {totalPnl >= 0 ? '+' : ''}{fmtD(totalPnl)}
              </p>
              <p className="text-xs text-muted-foreground">מחיר: {fmtD(pricePnl)} | דיב: +{fmtD(totalDivNet)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">דיבידנדים נטו</p>
              <p className="text-2xl font-bold text-green-500" dir="ltr">+{fmtD(totalDivNet)}</p>
              <p className="text-xs text-muted-foreground">ברוטו: {fmtD(totalDivGross)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Chart */}
        {performanceData.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>ביצועי התיקייה</CardTitle>
                <CardDescription>סכום מושקע מצטבר</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="sp500-cat" checked={showSP500} onCheckedChange={setShowSP500} />
                <Label htmlFor="sp500-cat" className="text-xs">S&P 500</Label>
              </div>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="holdings" dir="rtl">
          <TabsList>
            <TabsTrigger value="holdings">ניירות ערך ({catHoldings.length})</TabsTrigger>
            <TabsTrigger value="dividends">דיבידנדים ({catDividends.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="holdings">
            <Card>
              <CardContent className="pt-4">
                {catHoldings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">אין ניירות ערך בקטגוריה זו</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">סימול</TableHead>
                        <TableHead className="text-right">שם</TableHead>
                        <TableHead className="text-right">כמות</TableHead>
                        <TableHead className="text-right">עלות מקורית</TableHead>
                        <TableHead className="text-right">שווי</TableHead>
                        <TableHead className="text-right">רווח/הפסד מחיר</TableHead>
                        <TableHead className="text-right">דיב נטו</TableHead>
                        <TableHead className="text-right">תשואה כוללת</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catHoldings.map(h => {
                        const curr = getCurrencySymbol(h.currency || "ILS");
                        const price = h.current_price ?? h.average_cost;
                        const val = h.quantity * price;
                        const cost = h.quantity * h.average_cost;
                        const hPricePnl = val - cost;
                        const hDivNet = (holdingDivNet.get(h.id) || 0);
                        const hDivNetOrig = convertFromILS(hDivNet, h.currency || "ILS");
                        const hTotalPnl = hPricePnl + hDivNetOrig;
                        return (
                          <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/holding/${h.id}`)}>
                            <TableCell className="font-medium" dir="ltr">{h.fund_number || h.symbol}</TableCell>
                            <TableCell>{h.name}</TableCell>
                            <TableCell dir="ltr">{h.quantity.toLocaleString()}</TableCell>
                            <TableCell dir="ltr">{curr}{cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                            <TableCell dir="ltr">{curr}{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                            <TableCell dir="ltr" className={hPricePnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {h.current_price ? `${hPricePnl >= 0 ? '+' : ''}${curr}${hPricePnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                            </TableCell>
                            <TableCell dir="ltr" className="text-green-500">
                              {hDivNetOrig > 0 ? `+${curr}${hDivNetOrig.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                            </TableCell>
                            <TableCell dir="ltr" className={hTotalPnl >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                              {h.current_price ? `${hTotalPnl >= 0 ? '+' : ''}${curr}${hTotalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dividends">
            <Card>
              <CardContent className="pt-4">
                {catDividends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">אין דיבידנדים</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">תאריך</TableHead>
                        <TableHead className="text-right">נייר ערך</TableHead>
                        <TableHead className="text-right">ברוטו</TableHead>
                        <TableHead className="text-right">מס</TableHead>
                        <TableHead className="text-right">נטו</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...catDividends].sort((a, b) => (b.payment_date || "").localeCompare(a.payment_date || "")).map(d => {
                        const holding = holdings.find(h => h.id === d.holding_id);
                        const curr = getCurrencySymbol(d.currency || "ILS");
                        const net = d.amount - (d.tax_withheld || 0);
                        return (
                          <TableRow key={d.id}>
                            <TableCell dir="ltr">{d.payment_date ? new Date(d.payment_date).toLocaleDateString("he-IL") : "—"}</TableCell>
                            <TableCell>
                              <Link to={`/holding/${d.holding_id}`} className="hover:underline font-medium">
                                {holding?.symbol || "?"}
                              </Link>
                            </TableCell>
                            <TableCell dir="ltr" className="text-green-500">{curr}{d.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                            <TableCell dir="ltr" className="text-muted-foreground">{curr}{(d.tax_withheld || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                            <TableCell dir="ltr" className="font-semibold">{curr}{net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader><DialogTitle>עריכת קטגוריה</DialogTitle></DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await updateCategory.mutateAsync({
                id: category.id,
                name: fd.get("name") as string,
                target_percentage: parseFloat(fd.get("target") as string) || 0,
              });
              setEditOpen(false);
            }} className="space-y-4">
              <div className="space-y-2">
                <Label>שם</Label>
                <Input name="name" defaultValue={category.name} required />
              </div>
              <div className="space-y-2">
                <Label>יעד הקצאה (%)</Label>
                <Input name="target" type="number" min="0" max="100" defaultValue={category.target_percentage || 0} dir="ltr" />
              </div>
              <Button type="submit" className="w-full">שמור</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
