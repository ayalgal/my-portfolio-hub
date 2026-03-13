import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowRight, TrendingUp, TrendingDown, DollarSign, Calendar, SplitSquareVertical, Check, X, Loader2, Pencil, ShoppingCart, Tag } from "lucide-react";
import { useHoldings, Holding } from "@/hooks/useHoldings";
import { useTransactions } from "@/hooks/useTransactions";
import { useDividends } from "@/hooks/useDividends";
import { useSplits } from "@/hooks/useSplits";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { useAllocations } from "@/hooks/useAllocations";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDividendChangeInfo } from "@/components/dividends/DividendChangeArrow";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

const getCurrencySymbol = (c: string) => ({ ILS: "₪", USD: "$", CAD: "C$", EUR: "€" }[c] || c);

export default function HoldingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { portfolios } = usePortfolio();
  const { holdings, isLoading: holdingsLoading, updateHolding } = useHoldings(portfolios?.[0]?.id);
  const { transactions, isLoading: txLoading } = useTransactions(id);
  const { dividends, isLoading: divLoading, totalDividends, totalTaxWithheld } = useDividends(id);
  const { getCategoriesForHolding, assignCategory, removeCategory, holdingCategories } = useHoldingCategories();
  const { categories } = useAllocations();
  const { pendingSplits, applySplit, dismissSplit } = useSplits();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txType, setTxType] = useState<'buy' | 'sell'>('buy');

  const holding = holdings.find(h => h.id === id);
  const holdingSplits = pendingSplits.filter(s => s.holding_id === id);

  if (holdingsLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!holding) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-xl font-semibold mb-4">נייר ערך לא נמצא</h2>
          <Button onClick={() => navigate("/invest")}>
            <ArrowRight className="ml-2 h-4 w-4" />חזרה להשקעות
          </Button>
        </div>
      </AppLayout>
    );
  }

  const currSym = getCurrencySymbol(holding.currency || "ILS");
  const currentPrice = holding.current_price ?? holding.average_cost;
  const totalValue = holding.quantity * currentPrice;
  const totalCost = holding.quantity * holding.average_cost;
  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  const holdingCats = getCategoriesForHolding(holding.id);

  // Total return = price P&L + dividends after tax
  const netDividends = totalDividends - totalTaxWithheld;
  const totalReturn = pnl + netDividends;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  // Forward dividend estimate (last dividend × 4 annualized)
  const lastDiv = dividends.length > 0 ? dividends[0] : null;
  const forwardDivPerShare = lastDiv ? (lastDiv.amount / (lastDiv.shares_at_payment || holding.quantity)) * 4 : 0;
  const forwardYield = currentPrice > 0 ? (forwardDivPerShare / currentPrice) * 100 : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/invest")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{holding.name}</h1>
              <Badge variant="outline" dir="ltr">{holding.fund_number || holding.symbol}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {holdingCats.map(hc => (
                <Link key={hc.id} to={`/category/${hc.category_id}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:opacity-80" style={{ borderColor: (hc as any).allocation_categories?.color || undefined, color: (hc as any).allocation_categories?.color || undefined }}>
                    {(hc as any).allocation_categories?.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-4 w-4 ml-1" />עריכה
            </Button>
            <Button variant="default" size="sm" onClick={() => { setTxType('buy'); setTxDialogOpen(true); }}>
              <ShoppingCart className="h-4 w-4 ml-1" />קנייה
            </Button>
            <Button variant="destructive" size="sm" onClick={() => { setTxType('sell'); setTxDialogOpen(true); }}>
              מכירה
            </Button>
          </div>
        </div>

        {/* Split alerts for this holding */}
        {holdingSplits.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-base">
                <SplitSquareVertical className="h-5 w-5" />
                ספליטים שזוהו ({holdingSplits.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {holdingSplits.map((split) => {
                const ratio = split.ratio_to / split.ratio_from;
                const desc = ratio > 1
                  ? `ספליט ${split.ratio_from}:${split.ratio_to} — כל מניה תהפוך ל-${ratio} מניות`
                  : `איחוד ${split.ratio_from}:${split.ratio_to} — כל ${split.ratio_from / split.ratio_to} מניות יהפכו למניה אחת`;
                return (
                  <Alert key={split.id} className="bg-background">
                    <AlertTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{split.ratio_from}:{split.ratio_to}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(split.split_date).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => applySplit.mutate(split.id)} disabled={applySplit.isPending}>
                          {applySplit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 ml-1" />החל</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => dismissSplit.mutate(split.id)} disabled={dismissSplit.isPending}>
                          <X className="h-4 w-4 ml-1" />התעלם
                        </Button>
                      </div>
                    </AlertTitle>
                    <AlertDescription className="mt-1 text-sm">{desc}</AlertDescription>
                  </Alert>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">שווי נוכחי</p>
              <p className="text-2xl font-bold" dir="ltr">{currSym}{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">רווח/הפסד מחיר</p>
              <p className={`text-2xl font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`} dir="ltr">
                {pnl >= 0 ? '+' : ''}{currSym}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className={`text-xs ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>{pnlPercent.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">דיבידנדים נטו</p>
              <p className="text-2xl font-bold text-green-500" dir="ltr">{currSym}{netDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted-foreground">ברוטו: {currSym}{totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })} | מס: {currSym}{totalTaxWithheld.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">תשואה כוללת (מחיר + דיבידנד)</p>
              <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`} dir="ltr">
                {totalReturn >= 0 ? '+' : ''}{currSym}{totalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className={`text-xs ${totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>{totalReturnPercent.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">תשואת דיבידנד</p>
              <p className="text-2xl font-bold">{forwardYield.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground" dir="ltr">{currSym}{forwardDivPerShare.toFixed(2)}/מניה/שנה</p>
            </CardContent>
          </Card>
        </div>

        {/* Details Row */}
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><span className="text-muted-foreground">כמות:</span> <strong dir="ltr">{holding.quantity.toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">עלות ממוצעת:</span> <strong dir="ltr">{currSym}{holding.average_cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
              <div><span className="text-muted-foreground">מחיר נוכחי:</span> <strong dir="ltr">{holding.current_price ? `${currSym}${holding.current_price.toLocaleString()}` : '—'}</strong></div>
              <div><span className="text-muted-foreground">מטבע:</span> <strong>{holding.currency}</strong></div>
              <div><span className="text-muted-foreground">סוג:</span> <strong>{holding.asset_type}</strong></div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Transactions & Dividends */}
        <Tabs defaultValue="transactions" dir="rtl">
          <TabsList>
            <TabsTrigger value="transactions">עסקאות ({transactions.length})</TabsTrigger>
            <TabsTrigger value="dividends">דיבידנדים ({dividends.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card>
              <CardContent className="pt-4">
                {txLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">אין עסקאות</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">תאריך</TableHead>
                        <TableHead className="text-right">סוג</TableHead>
                        <TableHead className="text-right">כמות</TableHead>
                        <TableHead className="text-right">מחיר</TableHead>
                        <TableHead className="text-right">סה״כ</TableHead>
                        <TableHead className="text-right">הערות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell dir="ltr">{tx.transaction_date}</TableCell>
                          <TableCell>
                            <Badge variant={tx.transaction_type === 'buy' ? 'default' : tx.transaction_type === 'sell' ? 'destructive' : 'secondary'}>
                              {tx.transaction_type === 'buy' ? 'קנייה' : tx.transaction_type === 'sell' ? 'מכירה' : tx.transaction_type === 'split' ? 'ספליט' : tx.transaction_type}
                            </Badge>
                          </TableCell>
                          <TableCell dir="ltr">{tx.quantity.toLocaleString()}</TableCell>
                          <TableCell dir="ltr">{currSym}{tx.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                          <TableCell dir="ltr">{currSym}{tx.total_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{tx.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dividends">
            <Card>
              <CardContent className="pt-4">
                {divLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : dividends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">אין דיבידנדים — לחץ על "עדכן מחירים" בדשבורד כדי לטעון אוטומטית</p>
                ) : (
                  <TooltipProvider>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">סכום ברוטו</TableHead>
                          <TableHead className="text-right w-10">שינוי</TableHead>
                          <TableHead className="text-right">מס</TableHead>
                          <TableHead className="text-right">סכום נטו</TableHead>
                          <TableHead className="text-right">מניות</TableHead>
                          <TableHead className="text-right">הערות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dividends.map((div, idx) => {
                          const prevDiv = idx < dividends.length - 1 ? dividends[idx + 1] : null;
                          const changeInfo = getDividendChangeInfo(div.amount, prevDiv?.amount ?? null);
                          return (
                            <TableRow key={div.id}>
                              <TableCell dir="ltr">{div.payment_date}</TableCell>
                              <TableCell dir="ltr" className="text-green-500">{currSym}{div.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-default">{changeInfo.icon}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" dir="rtl">
                                    {changeInfo.changePercent !== null
                                      ? `${changeInfo.changePercent > 0 ? '+' : ''}${changeInfo.changePercent.toFixed(1)}% מהדיבידנד הקודם`
                                      : "אין דיבידנד קודם להשוואה"}
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell dir="ltr" className="text-red-500">{currSym}{(div.tax_withheld ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell dir="ltr" className="font-semibold">{currSym}{(div.amount - (div.tax_withheld ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell dir="ltr">{div.shares_at_payment}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{div.notes}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader><DialogTitle>עריכת {holding.name}</DialogTitle></DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await updateHolding.mutateAsync({
                id: holding.id,
                name: fd.get("name") as string,
                symbol: fd.get("symbol") as string,
                notes: fd.get("notes") as string || null,
              });
              setEditDialogOpen(false);
            }} className="space-y-4">
              <div className="space-y-2">
                <Label>שם</Label>
                <Input name="name" defaultValue={holding.name} required />
              </div>
              <div className="space-y-2">
                <Label>סימול</Label>
                <Input name="symbol" defaultValue={holding.symbol} dir="ltr" required />
              </div>
              <div className="space-y-2">
                <Label>הערות</Label>
                <Input name="notes" defaultValue={holding.notes || ""} />
              </div>
              <div className="space-y-2">
                <Label>קטגוריות</Label>
                <div className="flex flex-wrap gap-2">
                  {holdingCats.map(hc => (
                    <Badge key={hc.id} variant="secondary" className="gap-1" style={{ borderColor: (hc as any).allocation_categories?.color || undefined }}>
                      {(hc as any).allocation_categories?.name}
                      <button type="button" onClick={() => removeCategory.mutate(hc.id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                  {categories.filter(c => !holdingCats.some(hc => hc.category_id === c.id)).map(c => (
                    <Badge key={c.id} variant="outline" className="cursor-pointer opacity-50 hover:opacity-100" onClick={() => assignCategory.mutate({ holdingId: holding.id, categoryId: c.id })}>
                      + {c.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={updateHolding.isPending}>שמור</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Buy/Sell Dialog */}
        <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader><DialogTitle>{txType === 'buy' ? 'קניית' : 'מכירת'} {holding.symbol}</DialogTitle></DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!user?.id) return;
              const fd = new FormData(e.currentTarget);
              const qty = parseFloat(fd.get("quantity") as string) || 0;
              const price = parseFloat(fd.get("price") as string) || 0;
              const total = qty * price;
              const { error } = await supabase.from("transactions").insert({
                holding_id: holding.id,
                user_id: user.id,
                transaction_type: txType,
                quantity: qty,
                price,
                total_amount: total,
                transaction_date: fd.get("date") as string || new Date().toISOString().split("T")[0],
                currency: holding.currency || "ILS",
              });
              if (error) { toast({ variant: "destructive", title: "שגיאה", description: error.message }); return; }
              // Update holding quantity & average cost
              const newQty = txType === 'buy' ? holding.quantity + qty : holding.quantity - qty;
              const newAvgCost = txType === 'buy' && newQty > 0
                ? ((holding.quantity * holding.average_cost) + total) / newQty
                : holding.average_cost;
              await updateHolding.mutateAsync({ id: holding.id, quantity: newQty, average_cost: newAvgCost });
              queryClient.invalidateQueries({ queryKey: ["transactions"] });
              toast({ title: txType === 'buy' ? 'קנייה בוצעה' : 'מכירה בוצעה', description: `${qty} יחידות ב-${getCurrencySymbol(holding.currency || "ILS")}${price}` });
              setTxDialogOpen(false);
            }} className="space-y-4">
              <div className="space-y-2">
                <Label>תאריך</Label>
                <Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>כמות</Label>
                <Input name="quantity" type="number" step="any" min="0.01" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>מחיר ליחידה ({getCurrencySymbol(holding.currency || "ILS")})</Label>
                <Input name="price" type="number" step="any" min="0" required dir="ltr" defaultValue={holding.current_price?.toString() || ""} />
              </div>
              <Button type="submit" className="w-full" variant={txType === 'buy' ? 'default' : 'destructive'}>
                {txType === 'buy' ? 'בצע קנייה' : 'בצע מכירה'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
