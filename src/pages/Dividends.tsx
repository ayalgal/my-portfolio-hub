import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, DollarSign, TrendingUp, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDividends } from "@/hooks/useDividends";
import { useHoldings } from "@/hooks/useHoldings";

export default function Dividends() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isIsraeli, setIsIsraeli] = useState(false);
  const [selectedHoldingId, setSelectedHoldingId] = useState("");
  const { dividends, isLoading, createDividend } = useDividends();
  const { holdings } = useHoldings();

  const handleAddDividend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get("amount") as string) || 0;
    const taxRate = 0.25;

    createDividend.mutate({
      holding_id: selectedHoldingId,
      amount,
      currency: isIsraeli ? "ILS" : "USD",
      payment_date: formData.get("paymentDate") as string,
      shares_at_payment: parseFloat(formData.get("shares") as string) || 0,
      is_israeli: isIsraeli,
      tax_withheld: amount * taxRate,
    }, {
      onSuccess: () => setIsDialogOpen(false),
    });
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };
    return symbols[currency || "ILS"] || currency;
  };

  const totalDividends = dividends.reduce((sum, d) => {
    const rate = d.currency === "USD" ? 3.7 : d.currency === "EUR" ? 4.0 : 1;
    return sum + d.amount * rate;
  }, 0);

  const totalTax = dividends.reduce((sum, d) => {
    const rate = d.currency === "USD" ? 3.7 : d.currency === "EUR" ? 4.0 : 1;
    return sum + (d.tax_withheld || 0) * rate;
  }, 0);

  const israeliCount = dividends.filter(d => d.is_israeli).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">דיבידנדים</h1>
            <p className="text-muted-foreground">מעקב אחר הכנסות מדיבידנדים</p>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="israeli">דיבידנד ישראלי</Label>
                  <Switch id="israeli" checked={isIsraeli} onCheckedChange={setIsIsraeli} />
                </div>
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
                    <Label htmlFor="amount">סכום ({isIsraeli ? '₪' : '$'})</Label>
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
                <Button type="submit" className="w-full" disabled={createDividend.isPending || !selectedHoldingId}>
                  {createDividend.isPending ? "מוסיף..." : "הוסף"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">סה״כ דיבידנדים</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-green-500">₪{totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground">מ-{dividends.length} תשלומים</p>
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
                  <div className="text-2xl font-bold">₪{totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground">ניכוי במקור</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">דיבידנדים ישראליים</CardTitle>
              <Flag className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-blue-500">{israeliCount}</div>
                  <p className="text-xs text-muted-foreground">מתוך {dividends.length} סה״כ</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>היסטוריית דיבידנדים</CardTitle>
            <CardDescription>כל הדיבידנדים שהתקבלו</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40 w-full" /> : dividends.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">אין דיבידנדים עדיין</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">מניות</TableHead>
                    <TableHead className="text-right">מס</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dividends.map((d) => {
                    const cs = getCurrencySymbol(d.currency || "ILS");
                    return (
                      <TableRow key={d.id}>
                        <TableCell dir="ltr">{d.payment_date ? new Date(d.payment_date).toLocaleDateString('he-IL') : '-'}</TableCell>
                        <TableCell dir="ltr" className="font-semibold text-green-500">{cs}{d.amount.toLocaleString()}</TableCell>
                        <TableCell dir="ltr">{d.shares_at_payment || '-'}</TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground">{cs}{(d.tax_withheld || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={d.is_israeli ? "default" : "secondary"}>
                            {d.is_israeli ? "ישראלי" : "בינלאומי"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
