import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const getCurrencySymbol = (c: string) => ({ ILS: "₪", USD: "$", CAD: "C$", EUR: "€" }[c] || c);

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { categories, updateCategory, isLoading: catLoading } = useAllocations();
  const { portfolios } = usePortfolio();
  const { holdings } = useHoldings(portfolios?.[0]?.id);
  const { holdingCategories } = useHoldingCategories();
  const { dividends } = useDividends();
  const { convertToILS, convertFromILS } = useExchangeRates();
  const [editOpen, setEditOpen] = useState(false);

  const category = categories.find(c => c.id === id);

  const catHoldingIds = holdingCategories.filter(hc => hc.category_id === id).map(hc => hc.holding_id);
  const catHoldings = holdings.filter(h => catHoldingIds.includes(h.id));

  // Dividends for this category's holdings
  const catDividends = dividends.filter(d => catHoldingIds.includes(d.holding_id));
  const totalDivGross = catDividends.reduce((s, d) => s + convertToILS(d.amount, d.currency || "ILS"), 0);
  const totalDivTax = catDividends.reduce((s, d) => s + convertToILS(d.tax_withheld || 0, d.currency || "ILS"), 0);

  const totalValue = catHoldings.reduce((s, h) => {
    const price = h.current_price ?? h.average_cost;
    return s + convertToILS(h.quantity * price, h.currency || "ILS");
  }, 0);

  const totalCost = catHoldings.reduce((s, h) => s + convertToILS(h.quantity * h.average_cost, h.currency || "ILS"), 0);
  const pnl = totalValue - totalCost;

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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">ניירות ערך</p>
              <p className="text-2xl font-bold">{catHoldings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">שווי כולל</p>
              <p className="text-2xl font-bold" dir="ltr">₪{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">רווח/הפסד</p>
              <p className={`text-2xl font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`} dir="ltr">
                {pnl >= 0 ? '+' : ''}₪{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">דיבידנדים נטו</p>
              <p className="text-2xl font-bold text-green-500" dir="ltr">₪{(totalDivGross - totalDivTax).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted-foreground">ברוטו: ₪{totalDivGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
        </div>

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
                        <TableHead className="text-right">שווי</TableHead>
                        <TableHead className="text-right">רווח/הפסד</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catHoldings.map(h => {
                        const curr = getCurrencySymbol(h.currency || "ILS");
                        const price = h.current_price ?? h.average_cost;
                        const val = h.quantity * price;
                        const cost = h.quantity * h.average_cost;
                        const hPnl = val - cost;
                        return (
                          <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/holding/${h.id}`)}>
                            <TableCell className="font-medium" dir="ltr">{h.fund_number || h.symbol}</TableCell>
                            <TableCell>{h.name}</TableCell>
                            <TableCell dir="ltr">{h.quantity.toLocaleString()}</TableCell>
                            <TableCell dir="ltr">{curr}{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                            <TableCell dir="ltr" className={hPnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {h.current_price ? `${hPnl >= 0 ? '+' : ''}${curr}${hPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
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
                            <TableCell dir="ltr">{d.payment_date}</TableCell>
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
