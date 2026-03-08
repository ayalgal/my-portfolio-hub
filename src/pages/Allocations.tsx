import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useAllocations } from "@/hooks/useAllocations";
import { useHoldings } from "@/hooks/useHoldings";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const colorOptions = [
  "#22c55e", "#f97316", "#3b82f6", "#6b7280",
  "#8b5cf6", "#ef4444", "#ec4899", "#06b6d4",
];

export default function Allocations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);

  const { categories, createCategory, deleteCategory, totalTarget, isLoading } = useAllocations();
  const { portfolios } = usePortfolio();
  const { holdings } = useHoldings(portfolios?.[0]?.id);
  const { holdingCategories, getCategoriesForHolding } = useHoldingCategories();
  const { convertToILS, convertFromILS } = useExchangeRates();

  // Calculate actual values per category
  const categoryData = categories.map((cat) => {
    const linkedHoldingIds = holdingCategories
      .filter(hc => hc.category_id === cat.id)
      .map(hc => hc.holding_id);

    const catHoldings = holdings.filter(h => linkedHoldingIds.includes(h.id));
    const valueUSD = catHoldings.reduce((sum, h) => {
      const val = h.quantity * (h.current_price ?? h.average_cost);
      return sum + convertFromILS(convertToILS(val, h.currency || "ILS"), "USD");
    }, 0);

    return {
      ...cat,
      valueUSD,
      holdingsCount: catHoldings.length,
    };
  });

  // Uncategorized holdings
  const categorizedHoldingIds = new Set(holdingCategories.map(hc => hc.holding_id));
  const uncategorizedHoldings = holdings.filter(h => !categorizedHoldingIds.has(h.id));
  const uncategorizedValueUSD = uncategorizedHoldings.reduce((sum, h) => {
    const val = h.quantity * (h.current_price ?? h.average_cost);
    return sum + convertFromILS(convertToILS(val, h.currency || "ILS"), "USD");
  }, 0);

  const totalValueUSD = categoryData.reduce((sum, c) => sum + c.valueUSD, 0) + uncategorizedValueUSD;

  // Pie chart data
  const pieData = [
    ...categoryData
      .filter(c => c.valueUSD > 0)
      .map(c => ({
        name: c.name,
        value: Math.round(c.valueUSD),
        color: c.color || "#6b7280",
        percent: totalValueUSD > 0 ? (c.valueUSD / totalValueUSD) * 100 : 0,
      })),
    ...(uncategorizedValueUSD > 0 ? [{
      name: "ללא קטגוריה",
      value: Math.round(uncategorizedValueUSD),
      color: "#d1d5db",
      percent: totalValueUSD > 0 ? (uncategorizedValueUSD / totalValueUSD) * 100 : 0,
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
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          selectedColor === color ? 'scale-125 ring-2 ring-offset-2 ring-primary' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
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

        {/* Pie Chart + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">התפלגות הפורטפוליו</CardTitle>
              <CardDescription>שווי כולל: ${totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                  אין נתונים להצגה
                </div>
              )}
              {/* Legend */}
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

          {/* Categories List */}
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Plus className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין קטגוריות</h3>
                  <p className="text-muted-foreground text-center mb-4">הוסף קטגוריות הקצאה לניהול הפורטפוליו</p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="ml-2 h-4 w-4" />הוסף קטגוריה
                  </Button>
                </CardContent>
              </Card>
            ) : (
              categoryData.map((category) => {
                const actualPercent = totalValueUSD > 0 ? (category.valueUSD / totalValueUSD) * 100 : 0;
                const targetPercent = category.target_percentage ?? 0;
                const diff = actualPercent - targetPercent;

                return (
                  <Card key={category.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color || "#6b7280" }} />
                          <div>
                            <h3 className="font-semibold">{category.name}</h3>
                            <p className="text-xs text-muted-foreground">{category.holdingsCount} נכסים</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <p className="font-semibold">${category.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs text-muted-foreground">{actualPercent.toFixed(1)}%</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => deleteCategory.mutateAsync(category.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      {targetPercent > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>בפועל: {actualPercent.toFixed(1)}%</span>
                            <span>יעד: {targetPercent}%</span>
                          </div>
                          <Progress value={targetPercent > 0 ? (actualPercent / targetPercent) * 100 : 0} className="h-2" />
                          <p className={`text-xs ${diff > 2 ? 'text-yellow-500' : diff < -2 ? 'text-blue-500' : 'text-green-500'}`}>
                            {diff > 2 ? `עודף משקל +${diff.toFixed(1)}%` : diff < -2 ? `חסר משקל ${diff.toFixed(1)}%` : 'מאוזן ✓'}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
