import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useAllocations } from "@/hooks/useAllocations";
import { useHoldings } from "@/hooks/useHoldings";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

const colorOptions = [
  "#22c55e", "#f97316", "#3b82f6", "#6b7280",
  "#8b5cf6", "#ef4444", "#ec4899", "#06b6d4",
];

const getCurrencySymbol = (c: string) => ({ ILS: "₪", USD: "$", CAD: "C$", EUR: "€" }[c] || c);

export default function Allocations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const navigate = useNavigate();

  const { categories, createCategory, deleteCategory, totalTarget, isLoading } = useAllocations();
  const { portfolios } = usePortfolio();
  const { holdings } = useHoldings(portfolios?.[0]?.id);
  const { holdingCategories } = useHoldingCategories();
  const { convertToILS, convertFromILS } = useExchangeRates();

  const getCategoryHoldings = (categoryId: string) => {
    const linkedIds = holdingCategories.filter(hc => hc.category_id === categoryId).map(hc => hc.holding_id);
    return holdings.filter(h => linkedIds.includes(h.id));
  };

  const getHoldingValueUSD = (h: any) => {
    const val = h.quantity * (h.current_price ?? h.average_cost);
    return convertFromILS(convertToILS(val, h.currency || "ILS"), "USD");
  };

  const categoryData = categories.map((cat) => {
    const catHoldings = getCategoryHoldings(cat.id);
    const valueUSD = catHoldings.reduce((sum, h) => sum + getHoldingValueUSD(h), 0);
    return { ...cat, valueUSD, holdings: catHoldings };
  });

  const categorizedIds = new Set(holdingCategories.map(hc => hc.holding_id));
  const uncategorized = holdings.filter(h => !categorizedIds.has(h.id));
  const uncategorizedUSD = uncategorized.reduce((sum, h) => sum + getHoldingValueUSD(h), 0);
  const totalValueUSD = categoryData.reduce((s, c) => s + c.valueUSD, 0) + uncategorizedUSD;

  const pieData = [
    ...categoryData.filter(c => c.valueUSD > 0).map(c => ({
      name: c.name, value: Math.round(c.valueUSD), color: c.color || "#6b7280",
      percent: totalValueUSD > 0 ? (c.valueUSD / totalValueUSD) * 100 : 0,
    })),
    ...(uncategorizedUSD > 0 ? [{
      name: "ללא קטגוריה", value: Math.round(uncategorizedUSD), color: "#d1d5db",
      percent: totalValueUSD > 0 ? (uncategorizedUSD / totalValueUSD) * 100 : 0,
    }] : []),
  ];

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await createCategory.mutateAsync({
      name: formData.get("name") as string,
      target_percentage: parseFloat(formData.get("target") as string) || 0,
      color: selectedColor,
    });
    setIsDialogOpen(false);
    setSelectedColor(colorOptions[0]);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="font-medium text-sm">{data.name}</p>
          <p className="text-sm text-muted-foreground">${data.value.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{data.percent.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  const HoldingsTable = ({ catHoldings }: { catHoldings: typeof holdings }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">סימול</TableHead>
          <TableHead className="text-right">שם</TableHead>
          <TableHead className="text-right">כמות</TableHead>
          <TableHead className="text-right">שווי</TableHead>
          <TableHead className="text-right">רווח/הפסד</TableHead>
          <TableHead className="w-[40px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {catHoldings.map(h => {
          const curr = getCurrencySymbol(h.currency || "ILS");
          const price = h.current_price ?? h.average_cost;
          const val = h.quantity * price;
          const cost = h.quantity * h.average_cost;
          const pnl = val - cost;
          return (
            <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/holding/${h.id}`)}>
              <TableCell className="font-medium" dir="ltr">{h.fund_number || h.symbol}</TableCell>
              <TableCell>{h.name}</TableCell>
              <TableCell dir="ltr">{h.quantity.toLocaleString()}</TableCell>
              <TableCell dir="ltr">{curr}{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
              <TableCell dir="ltr" className={pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                {h.current_price ? `${pnl >= 0 ? '+' : ''}${curr}${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
              </TableCell>
              <TableCell>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">הקצאות</h1>
            <p className="text-muted-foreground">הגדר והשווה הקצאת נכסים יעד מול בפועל</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="ml-2 h-4 w-4" />הוסף קטגוריה</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף קטגוריית הקצאה</DialogTitle>
                <DialogDescription>הגדר קטגוריה חדשה עם יעד הקצאה</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">שם הקטגוריה</Label>
                  <Input id="name" name="name" placeholder="מניות צמיחה" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">יעד הקצאה (%)</Label>
                  <Input id="target" name="target" type="number" min="0" max="100" placeholder="20" required dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>צבע</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button key={color} type="button" onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full transition-transform ${selectedColor === color ? 'scale-125 ring-2 ring-offset-2 ring-primary' : ''}`}
                        style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createCategory.isPending}>
                  {createCategory.isPending ? "מוסיף..." : "הוסף"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pie Chart */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">התפלגות הפורטפוליו</CardTitle>
              <CardDescription>שווי כולל: ${totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground">אין נתונים</div>
              )}
              <div className="mt-4 space-y-2">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="text-muted-foreground">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <div className="lg:col-span-2 space-y-3">
            {isLoading ? (
              <><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Plus className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין קטגוריות</h3>
                  <Button onClick={() => setIsDialogOpen(true)}><Plus className="ml-2 h-4 w-4" />הוסף קטגוריה</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {categoryData.map((cat) => {
                  const actualPct = totalValueUSD > 0 ? (cat.valueUSD / totalValueUSD) * 100 : 0;
                  const targetPct = cat.target_percentage ?? 0;
                  const diff = actualPct - targetPct;
                  const isExpanded = expandedCategory === cat.id;

                  return (
                    <Card key={cat.id} className="overflow-hidden">
                        <div className="flex items-center justify-between py-4 px-6 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color || "#6b7280" }} />
                            <div>
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/category/${cat.id}`); }} className="font-semibold hover:underline">{cat.name}</button>
                              <p className="text-xs text-muted-foreground">{cat.holdings.length} נכסים</p>
                            </div>
                          </div>
                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <p className="font-semibold" dir="ltr">${cat.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs text-muted-foreground">{actualPct.toFixed(1)}%{targetPct > 0 ? ` / יעד ${targetPct}%` : ''}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deleteCategory.mutateAsync(cat.id); }}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>
                      {targetPct > 0 && (
                        <div className="px-6 pb-2">
                          <Progress value={targetPct > 0 ? Math.min((actualPct / targetPct) * 100, 150) : 0} className="h-1.5" />
                          <p className={`text-xs mt-1 ${diff > 2 ? 'text-yellow-500' : diff < -2 ? 'text-blue-500' : 'text-green-500'}`}>
                            {diff > 2 ? `עודף +${diff.toFixed(1)}%` : diff < -2 ? `חסר ${diff.toFixed(1)}%` : 'מאוזן ✓'}
                          </p>
                        </div>
                      )}
                      {isExpanded && cat.holdings.length > 0 && (
                        <div className="border-t px-4 pb-4">
                          <HoldingsTable catHoldings={cat.holdings} />
                        </div>
                      )}
                      {isExpanded && cat.holdings.length === 0 && (
                        <div className="border-t px-6 py-4 text-center text-muted-foreground text-sm">
                          אין ניירות ערך בקטגוריה זו. הוסף מדף ההשקעות.
                        </div>
                      )}
                    </Card>
                  );
                })}

                {/* Uncategorized */}
                {uncategorized.length > 0 && (
                  <Card className="overflow-hidden">
                    <div
                      className="flex items-center justify-between py-4 px-6 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedCategory(expandedCategory === '__uncategorized' ? null : '__uncategorized')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-muted-foreground/30" />
                        <div>
                          <h3 className="font-semibold text-muted-foreground">ללא קטגוריה</h3>
                          <p className="text-xs text-muted-foreground">{uncategorized.length} נכסים</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold text-muted-foreground" dir="ltr">${uncategorizedUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        {expandedCategory === '__uncategorized' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                    {expandedCategory === '__uncategorized' && (
                      <div className="border-t px-4 pb-4">
                        <HoldingsTable catHoldings={uncategorized} />
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
