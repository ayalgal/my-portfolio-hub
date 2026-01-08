import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, TrendingUp, TrendingDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

type AssetType = 'stock' | 'etf' | 'mutual_fund' | 'israeli_fund';

interface Holding {
  id: string;
  symbol: string;
  name: string;
  asset_type: AssetType;
  quantity: number;
  average_cost: number;
  current_price?: number;
  currency: string;
}

export default function Invest() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const { toast } = useToast();

  const handleAddHolding = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newHolding: Holding = {
      id: crypto.randomUUID(),
      symbol: formData.get("symbol") as string,
      name: formData.get("name") as string,
      asset_type: formData.get("assetType") as AssetType,
      quantity: parseFloat(formData.get("quantity") as string) || 0,
      average_cost: parseFloat(formData.get("averageCost") as string) || 0,
      currency: formData.get("currency") as string || "ILS",
    };

    setHoldings([...holdings, newHolding]);
    setIsDialogOpen(false);
    toast({
      title: "נוסף בהצלחה",
      description: `${newHolding.name} נוסף לפורטפוליו`,
    });
  };

  const deleteHolding = (id: string) => {
    setHoldings(holdings.filter(h => h.id !== id));
    toast({
      title: "נמחק",
      description: "נייר הערך הוסר מהפורטפוליו",
    });
  };

  const getAssetTypeLabel = (type: AssetType) => {
    const labels: Record<AssetType, string> = {
      stock: "מניה",
      etf: "ETF",
      mutual_fund: "קרן נאמנות",
      israeli_fund: "קרן כספית ישראלית",
    };
    return labels[type];
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      ILS: "₪",
      USD: "$",
      EUR: "€",
    };
    return symbols[currency] || currency;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">השקעות</h1>
            <p className="text-muted-foreground">ניהול ניירות הערך בפורטפוליו שלך</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                הוסף נייר ערך
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף נייר ערך חדש</DialogTitle>
                <DialogDescription>
                  הזן את פרטי נייר הערך להוספה לפורטפוליו
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddHolding} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="symbol">סימול</Label>
                    <Input id="symbol" name="symbol" placeholder="AAPL" required dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assetType">סוג נכס</Label>
                    <Select name="assetType" defaultValue="stock">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stock">מניה</SelectItem>
                        <SelectItem value="etf">ETF</SelectItem>
                        <SelectItem value="mutual_fund">קרן נאמנות</SelectItem>
                        <SelectItem value="israeli_fund">קרן כספית ישראלית</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name">שם</Label>
                  <Input id="name" name="name" placeholder="Apple Inc." required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">כמות</Label>
                    <Input id="quantity" name="quantity" type="number" step="0.0001" placeholder="10" required dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="averageCost">עלות ממוצעת</Label>
                    <Input id="averageCost" name="averageCost" type="number" step="0.01" placeholder="150.00" required dir="ltr" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">מטבע</Label>
                  <Select name="currency" defaultValue="ILS">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ILS">₪ שקל</SelectItem>
                      <SelectItem value="USD">$ דולר</SelectItem>
                      <SelectItem value="EUR">€ אירו</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="submit" className="w-full">הוסף</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {holdings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין ניירות ערך עדיין</h3>
              <p className="text-muted-foreground text-center mb-4">
                התחל להוסיף ניירות ערך לפורטפוליו שלך
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="ml-2 h-4 w-4" />
                הוסף נייר ערך ראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>ניירות ערך ({holdings.length})</CardTitle>
              <CardDescription>רשימת כל ניירות הערך בפורטפוליו</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">סימול</TableHead>
                    <TableHead className="text-right">שם</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">כמות</TableHead>
                    <TableHead className="text-right">עלות ממוצעת</TableHead>
                    <TableHead className="text-right">שווי כולל</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding) => {
                    const totalValue = holding.quantity * holding.average_cost;
                    const currencySymbol = getCurrencySymbol(holding.currency);
                    
                    return (
                      <TableRow key={holding.id}>
                        <TableCell className="font-medium" dir="ltr">{holding.symbol}</TableCell>
                        <TableCell>{holding.name}</TableCell>
                        <TableCell>{getAssetTypeLabel(holding.asset_type)}</TableCell>
                        <TableCell dir="ltr">{holding.quantity.toLocaleString()}</TableCell>
                        <TableCell dir="ltr">{currencySymbol}{holding.average_cost.toLocaleString()}</TableCell>
                        <TableCell dir="ltr" className="font-semibold">
                          {currencySymbol}{totalValue.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Pencil className="ml-2 h-4 w-4" />
                                ערוך
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteHolding(holding.id)}
                              >
                                <Trash2 className="ml-2 h-4 w-4" />
                                מחק
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
