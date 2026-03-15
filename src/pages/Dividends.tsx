import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, DollarSign, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDividends } from "@/hooks/useDividends";
import { useHoldings } from "@/hooks/useHoldings";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { DividendFilters, type GroupBy } from "@/components/dividends/DividendFilters";
import { DividendTable } from "@/components/dividends/DividendTable";
import { DividendSummary } from "@/components/dividends/DividendSummary";
import { DividendForecast } from "@/components/dividends/DividendForecast";

type DisplayCurrency = "ILS" | "USD" | "CAD";
const currSymbols: Record<DisplayCurrency, string> = { ILS: "₪", USD: "$", CAD: "C$" };

export default function Dividends() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedHoldingId, setSelectedHoldingId] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("all");
  const [taxRate, setTaxRate] = useState(25);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("USD");
  const { dividends, isLoading, createDividend } = useDividends();
  const { holdings } = useHoldings();
  const { holdingCategories } = useHoldingCategories();
  const { convertToILS, convertFromILS } = useExchangeRates();

  const handleAddDividend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get("amount") as string) || 0;
    const selectedHolding = holdings.find(h => h.id === selectedHoldingId);
    const currency = selectedHolding?.currency || "USD";

    createDividend.mutate({
      holding_id: selectedHoldingId,
      amount,
      currency,
      payment_date: formData.get("paymentDate") as string,
      shares_at_payment: parseFloat(formData.get("shares") as string) || 0,
      is_israeli: currency === "ILS",
      tax_withheld: amount * (taxRate / 100),
    }, {
      onSuccess: () => setIsDialogOpen(false),
    });
  };

  const fmt = (amountILS: number) => {
    const val = convertFromILS(amountILS, displayCurrency);
    return `${currSymbols[displayCurrency]}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const totalDividendsILS = dividends.reduce((sum, d) => sum + convertToILS(d.amount, d.currency || "ILS"), 0);
  const totalTaxILS = dividends.reduce((sum, d) => sum + convertToILS(d.tax_withheld || 0, d.currency || "ILS"), 0);
  const totalNetILS = totalDividendsILS - totalTaxILS;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">דיבידנדים</h1>
            <p className="text-muted-foreground">מעקב אחר הכנסות מדיבידנדים</p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <Select value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}>
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">$ דולר</SelectItem>
                <SelectItem value="ILS">₪ שקל</SelectItem>
                <SelectItem value="CAD">C$ קנדי</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">שיעור מס (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-[90px]"
                dir="ltr"
              />
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="ml-2 h-4 w-4" />הוסף דיבידנד</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>הוסף דיבידנד</DialogTitle>
                  <DialogDescription>רשום דיבידנד שהתקבל</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddDividend} className="space-y-4">
                  <div className="space-y-2">
                    <Label>נייר ערך</Label>
                    <Select value={selectedHoldingId} onValueChange={setSelectedHoldingId}>
                      <SelectTrigger><SelectValue placeholder="בחר נייר ערך" /></SelectTrigger>
                      <SelectContent>
                        {holdings.map(h => (
                          <SelectItem key={h.id} value={h.id}>{h.symbol} - {h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">סכום ({(() => {
                        const h = holdings.find(h => h.id === selectedHoldingId);
                        return h ? ({ ILS: "₪", USD: "$", CAD: "C$", EUR: "€" }[h.currency || "USD"] || "$") : "$";
                      })()})</Label>
                      <Input id="amount" name="amount" type="number" step="0.01" placeholder="100.00" required dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shares">כמות מניות</Label>
                      <Input id="shares" name="shares" type="number" placeholder="100" required dir="ltr" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">תאריך תשלום</Label>
                    <Input id="paymentDate" name="paymentDate" type="date" required dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>מס ({taxRate}%)</Label>
                    <p className="text-xs text-muted-foreground">המס יחושב אוטומטית לפי השיעור שנבחר</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={createDividend.isPending || !selectedHoldingId}>
                    {createDividend.isPending ? "מוסיף..." : "הוסף"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">סה״כ דיבידנדים (ברוטו)</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-green-500">{fmt(totalDividendsILS)}</div>
                  <p className="text-xs text-muted-foreground">מ-{dividends.length} תשלומים · לפני מס</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">מס ששולם</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold">{fmt(totalTaxILS)}</div>
                  <p className="text-xs text-muted-foreground">ניכוי במקור</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">סה״כ נטו (אחרי מס)</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-blue-500">{fmt(totalNetILS)}</div>
                  <p className="text-xs text-muted-foreground">אחרי ניכוי מס {taxRate}%</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="received" dir="rtl">
          <TabsList>
            <TabsTrigger value="received">💰 התקבלו</TabsTrigger>
            <TabsTrigger value="history">📋 פירוט עסקאות</TabsTrigger>
            <TabsTrigger value="summary">📊 סיכום</TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            <Card className="border-green-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  דיבידנדים שהתקבלו
                </CardTitle>
                <CardDescription>פירוט חודשי של דיבידנדים ששולמו בפועל</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-40 w-full" /> : (
                  <DividendSummary dividends={dividends as any} holdingCategories={holdingCategories as any} view="monthly" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle>פירוט עסקאות דיבידנד</CardTitle>
                    <CardDescription>כל תשלומי הדיבידנד שהתקבלו בפועל</CardDescription>
                  </div>
                  <DividendFilters groupBy={groupBy} onGroupByChange={setGroupBy} taxRate={taxRate} onTaxRateChange={setTaxRate} />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-40 w-full" /> : (
                  <DividendTable dividends={dividends as any} groupBy={groupBy} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary">
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <DividendSummary dividends={dividends as any} holdingCategories={holdingCategories as any} view="summary" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
