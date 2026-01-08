import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, TrendingUp, DollarSign, Calendar, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Dividend {
  id: string;
  holdingName: string;
  holdingSymbol: string;
  amount: number;
  currency: string;
  paymentDate: string;
  sharesAtPayment: number;
  isIsraeli: boolean;
  taxWithheld: number;
}

export default function Dividends() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dividends, setDividends] = useState<Dividend[]>([
    {
      id: "1",
      holdingName: "Apple Inc.",
      holdingSymbol: "AAPL",
      amount: 24.50,
      currency: "USD",
      paymentDate: "2024-02-15",
      sharesAtPayment: 100,
      isIsraeli: false,
      taxWithheld: 6.13,
    },
    {
      id: "2",
      holdingName: "בנק הפועלים",
      holdingSymbol: "POLI",
      amount: 150,
      currency: "ILS",
      paymentDate: "2024-03-01",
      sharesAtPayment: 500,
      isIsraeli: true,
      taxWithheld: 37.50,
    },
  ]);
  const [isIsraeli, setIsIsraeli] = useState(false);
  const { toast } = useToast();

  const handleAddDividend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const amount = parseFloat(formData.get("amount") as string) || 0;
    const taxRate = isIsraeli ? 0.25 : 0.25; // Simplified tax calculation
    
    const newDividend: Dividend = {
      id: crypto.randomUUID(),
      holdingName: formData.get("holdingName") as string,
      holdingSymbol: formData.get("holdingSymbol") as string,
      amount,
      currency: isIsraeli ? "ILS" : "USD",
      paymentDate: formData.get("paymentDate") as string,
      sharesAtPayment: parseFloat(formData.get("shares") as string) || 0,
      isIsraeli,
      taxWithheld: amount * taxRate,
    };

    setDividends([newDividend, ...dividends]);
    setIsDialogOpen(false);
    toast({
      title: "דיבידנד נוסף",
      description: `דיבידנד מ-${newDividend.holdingName} נוסף בהצלחה`,
    });
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };
    return symbols[currency] || currency;
  };

  // Calculate stats
  const totalDividends = dividends.reduce((sum, d) => {
    // Convert to ILS for total (simplified)
    const rate = d.currency === "USD" ? 3.7 : d.currency === "EUR" ? 4.0 : 1;
    return sum + d.amount * rate;
  }, 0);

  const totalTax = dividends.reduce((sum, d) => {
    const rate = d.currency === "USD" ? 3.7 : d.currency === "EUR" ? 4.0 : 1;
    return sum + d.taxWithheld * rate;
  }, 0);

  const israeliDividends = dividends.filter(d => d.isIsraeli).length;

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
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                הוסף דיבידנד
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף דיבידנד</DialogTitle>
                <DialogDescription>
                  רשום דיבידנד שהתקבל
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddDividend} className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="israeli">דיבידנד ישראלי</Label>
                  <Switch 
                    id="israeli" 
                    checked={isIsraeli} 
                    onCheckedChange={setIsIsraeli}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="holdingSymbol">סימול</Label>
                    <Input id="holdingSymbol" name="holdingSymbol" placeholder="AAPL" required dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holdingName">שם החברה</Label>
                    <Input id="holdingName" name="holdingName" placeholder="Apple Inc." required />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">סכום ({isIsraeli ? '₪' : '$'})</Label>
                    <Input 
                      id="amount" 
                      name="amount" 
                      type="number" 
                      step="0.01" 
                      placeholder="100.00" 
                      required 
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shares">כמות מניות</Label>
                    <Input 
                      id="shares" 
                      name="shares" 
                      type="number" 
                      placeholder="100" 
                      required 
                      dir="ltr"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">תאריך תשלום</Label>
                  <Input 
                    id="paymentDate" 
                    name="paymentDate" 
                    type="date" 
                    required 
                    dir="ltr"
                  />
                </div>
                
                <Button type="submit" className="w-full">הוסף</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">סה״כ דיבידנדים</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                ₪{totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                מ-{dividends.length} תשלומים
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">מס ששולם</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₪{totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                ניכוי במקור
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">דיבידנדים ישראליים</CardTitle>
              <Flag className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {israeliDividends}
              </div>
              <p className="text-xs text-muted-foreground">
                מתוך {dividends.length} סה״כ
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Dividends Table */}
        <Card>
          <CardHeader>
            <CardTitle>היסטוריית דיבידנדים</CardTitle>
            <CardDescription>כל הדיבידנדים שהתקבלו</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">נייר ערך</TableHead>
                  <TableHead className="text-right">סכום</TableHead>
                  <TableHead className="text-right">מניות</TableHead>
                  <TableHead className="text-right">למניה</TableHead>
                  <TableHead className="text-right">מס</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dividends.map((dividend) => {
                  const perShare = dividend.amount / dividend.sharesAtPayment;
                  const currencySymbol = getCurrencySymbol(dividend.currency);
                  
                  return (
                    <TableRow key={dividend.id}>
                      <TableCell dir="ltr">
                        {new Date(dividend.paymentDate).toLocaleDateString('he-IL')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{dividend.holdingSymbol}</span>
                          <p className="text-xs text-muted-foreground">{dividend.holdingName}</p>
                        </div>
                      </TableCell>
                      <TableCell dir="ltr" className="font-semibold text-green-500">
                        {currencySymbol}{dividend.amount.toLocaleString()}
                      </TableCell>
                      <TableCell dir="ltr">{dividend.sharesAtPayment}</TableCell>
                      <TableCell dir="ltr">
                        {currencySymbol}{perShare.toFixed(4)}
                      </TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">
                        {currencySymbol}{dividend.taxWithheld.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={dividend.isIsraeli ? "default" : "secondary"}>
                          {dividend.isIsraeli ? "ישראלי" : "בינלאומי"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
