import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, TrendingUp, MoreHorizontal, Trash2, Tag, X, ArrowUpDown, ArrowUp, ArrowDown, Search, LayoutGrid, List, Pencil } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useHoldings } from "@/hooks/useHoldings";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useAllocations } from "@/hooks/useAllocations";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddHoldingDialog } from "@/components/AddHoldingDialog";
import { UpdateSavingsDialog } from "@/components/UpdateSavingsDialog";


const PRESET_CATEGORIES = [
  { name: "דיבידנד קלאסי", color: "#22c55e" },
  { name: "אולטרא דיבידנד", color: "#f97316" },
  { name: "צמיחה", color: "#3b82f6" },
  { name: "ביטחונות", color: "#6b7280" },
  { name: "החזקות", color: "#8b5cf6" },
  { name: "קריפטו", color: "#eab308" },
  { name: "סקטור טכנולוגיה", color: "#06b6d4" },
  { name: "סקטור בריאות", color: "#ec4899" },
  { name: "סקטור אנרגיה", color: "#ef4444" },
  { name: "סקטור פיננסי", color: "#14b8a6" },
];

export default function Invest() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [savingsToUpdate, setSavingsToUpdate] = useState<any>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterText, setFilterText] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "category">("list");
  const { portfolios } = usePortfolio();
  const defaultPortfolioId = portfolios?.[0]?.id;
  const { holdings, isLoading, createHolding, deleteHolding } = useHoldings(defaultPortfolioId);
  const { categories, createCategory } = useAllocations();
  const { holdingCategories, assignCategory, removeCategory, getCategoriesForHolding } = useHoldingCategories();
  const { convertToILS } = useExchangeRates();
  const { toast } = useToast();

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };


  const handleAssignCategory = async (holdingId: string, categoryId: string) => {
    const existing = getCategoriesForHolding(holdingId);
    if (existing.some(hc => hc.category_id === categoryId)) return;
    assignCategory.mutate({ holdingId, categoryId });
  };

  const handleCreateAndAssign = async (holdingId: string, name: string, color: string) => {
    try {
      const result = await createCategory.mutateAsync({ name, color });
      assignCategory.mutate({ holdingId, categoryId: result.id });
    } catch {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן ליצור קטגוריה" });
    }
  };

  const getAssetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stock: "מניה",
      etf: "ETF",
      mutual_fund: "קרן נאמנות",
      israeli_fund: "קרן כספית",
      bank_savings: "חיסכון בנקאי",
    };
    return labels[type] || type;
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { ILS: "₪", USD: "$", CAD: "C$", EUR: "€" };
    return symbols[currency || "ILS"] || currency;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">השקעות</h1>
            <p className="text-muted-foreground">ניהול ניירות הערך בפורטפוליו שלך</p>
          </div>
          
          <Button onClick={() => setIsDialogOpen(true)}><Plus className="ml-2 h-4 w-4" />הוסף נייר ערך</Button>
          <AddHoldingDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </div>


        {(() => {
          const filtered = holdings.filter(h => {
            if (!filterText) return true;
            const q = filterText.toLowerCase();
            return h.name.toLowerCase().includes(q) || h.symbol.toLowerCase().includes(q);
          });
          const activeHoldings = filtered.filter(h => h.quantity > 0);
          const archivedHoldings = filtered.filter(h => h.quantity <= 0);

          const getValueILS = (h: typeof holdings[0]) => {
            const cp = h.current_price ?? h.average_cost;
            return convertToILS(h.quantity * cp, h.currency || "ILS");
          };
          const getPnlILS = (h: typeof holdings[0]) => {
            if (!h.current_price) return 0;
            const cp = h.current_price;
            return convertToILS(h.quantity * cp - h.quantity * h.average_cost, h.currency || "ILS");
          };
          const getPnlPercent = (h: typeof holdings[0]) => {
            if (!h.current_price) return 0;
            const cost = h.quantity * h.average_cost;
            return cost > 0 ? ((h.quantity * h.current_price - cost) / cost) * 100 : 0;
          };

          const sortedActive = [...activeHoldings].sort((a, b) => {
            const getVal = (h: typeof a) => {
              const cp = h.current_price ?? h.average_cost;
              switch (sortField) {
                case "symbol": return h.symbol;
                case "name": return h.name;
                case "type": return h.asset_type;
                case "category": {
                  const cats = getCategoriesForHolding(h.id);
                  return cats.length > 0 ? (cats[0] as any).allocation_categories?.name || "" : "zzz";
                }
                case "quantity": return h.quantity;
                case "avgCost": return h.average_cost;
                case "price": return cp;
                case "value": return getValueILS(h);
                case "pnl": return getPnlILS(h);
                case "pnlPct": return getPnlPercent(h);
                default: return h.name;
              }
            };
            const va = getVal(a), vb = getVal(b);
            const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
            return sortDir === "asc" ? cmp : -cmp;
          });

          // Category grouped view
          const categoryGroups = categories.map(cat => {
            const catHoldingIds = holdingCategories.filter(hc => hc.category_id === cat.id).map(hc => hc.holding_id);
            return { ...cat, catHoldings: activeHoldings.filter(h => catHoldingIds.includes(h.id)) };
          }).filter(g => g.catHoldings.length > 0);
          const categorizedIds = new Set(holdingCategories.map(hc => hc.holding_id));
          const uncategorizedHoldings = activeHoldings.filter(h => !categorizedIds.has(h.id));
          
          return isLoading ? (
          <Card><CardContent className="py-8"><Skeleton className="h-40 w-full" /></CardContent></Card>
        ) : activeHoldings.length === 0 && archivedHoldings.length === 0 && !filterText ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין ניירות ערך עדיין</h3>
              <p className="text-muted-foreground text-center mb-4">התחל להוסיף ניירות ערך לפורטפוליו שלך</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="ml-2 h-4 w-4" />הוסף נייר ערך ראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>ניירות ערך ({activeHoldings.length})</CardTitle>
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "category")}>
                    <TabsList className="h-8">
                      <TabsTrigger value="list" className="h-6 px-2"><List className="h-3 w-3" /></TabsTrigger>
                      <TabsTrigger value="category" className="h-6 px-2"><LayoutGrid className="h-3 w-3" /></TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="relative w-48">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="חיפוש..."
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    className="pr-9 h-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
            {viewMode === "list" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("symbol")}>
                      <span className="flex items-center gap-1">סימול <SortIcon field="symbol" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      <span className="flex items-center gap-1">שם <SortIcon field="name" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("type")}>
                      <span className="flex items-center gap-1">סוג <SortIcon field="type" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("category")}>
                      <span className="flex items-center gap-1">קטגוריות <SortIcon field="category" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("quantity")}>
                      <span className="flex items-center gap-1">כמות <SortIcon field="quantity" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("avgCost")}>
                      <span className="flex items-center gap-1">עלות ממוצעת <SortIcon field="avgCost" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("price")}>
                      <span className="flex items-center gap-1">מחיר נוכחי <SortIcon field="price" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("value")}>
                      <span className="flex items-center gap-1">שווי (₪) <SortIcon field="value" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("pnl")}>
                      <span className="flex items-center gap-1">רווח/הפסד (₪) <SortIcon field="pnl" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("pnlPct")}>
                      <span className="flex items-center gap-1">% <SortIcon field="pnlPct" /></span>
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedActive.map((holding) => {
                    const currentPrice = holding.current_price ?? holding.average_cost;
                    const totalValue = holding.quantity * currentPrice;
                    const totalCost = holding.quantity * holding.average_cost;
                    const pnl = totalValue - totalCost;
                    const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
                    const currencySymbol = getCurrencySymbol(holding.currency || "ILS");
                    const holdingCats = getCategoriesForHolding(holding.id);
                    const valueILS = getValueILS(holding);
                    const pnlILS = getPnlILS(holding);
                    
                    return (
                      <TableRow key={holding.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/holding/${holding.id}`)}>
                        <TableCell className="font-medium" dir="ltr">
                          {holding.fund_number || holding.symbol}
                        </TableCell>
                        <TableCell>{holding.name}</TableCell>
                        <TableCell>{getAssetTypeLabel(holding.asset_type)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {holdingCats.map((hc) => (
                              <Badge
                                key={hc.id}
                                variant="outline"
                                className="text-xs cursor-pointer group"
                                style={{ borderColor: (hc as any).allocation_categories?.color || undefined, color: (hc as any).allocation_categories?.color || undefined }}
                                onClick={(e) => { e.stopPropagation(); removeCategory.mutate(hc.id); }}
                              >
                                {(hc as any).allocation_categories?.name}
                                <X className="h-3 w-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Badge>
                            ))}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => e.stopPropagation()}>
                                  <Tag className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2" dir="rtl" align="start">
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">קטגוריות קיימות</p>
                                  {categories.map(cat => (
                                    <button
                                      key={cat.id}
                                      className="w-full text-right px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
                                      onClick={() => handleAssignCategory(holding.id, cat.id)}
                                    >
                                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6b7280' }} />
                                      {cat.name}
                                    </button>
                                  ))}
                                  <div className="border-t my-1" />
                                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">הוסף חדשה</p>
                                  {PRESET_CATEGORIES
                                    .filter(p => !categories.some(c => c.name === p.name))
                                    .slice(0, 5)
                                    .map(preset => (
                                      <button
                                        key={preset.name}
                                        className="w-full text-right px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
                                        onClick={() => handleCreateAndAssign(holding.id, preset.name, preset.color)}
                                      >
                                        <Plus className="h-3 w-3" />
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.color }} />
                                        {preset.name}
                                      </button>
                                    ))
                                  }
                                  <div className="flex gap-1 mt-1">
                                    <Input
                                      placeholder="שם קטגוריה..."
                                      value={newCategoryName}
                                      onChange={e => setNewCategoryName(e.target.value)}
                                      className="h-7 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2"
                                      disabled={!newCategoryName.trim()}
                                      onClick={() => {
                                        handleCreateAndAssign(holding.id, newCategoryName.trim(), '#6b7280');
                                        setNewCategoryName("");
                                      }}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableCell>
                        <TableCell dir="ltr">{holding.quantity.toLocaleString()}</TableCell>
                        <TableCell dir="ltr">{currencySymbol}{holding.average_cost.toLocaleString()}</TableCell>
                        <TableCell dir="ltr">
                          {holding.current_price 
                            ? `${currencySymbol}${holding.current_price.toLocaleString()}`
                            : <span className="text-muted-foreground">—</span>
                          }
                        </TableCell>
                        <TableCell dir="ltr" className="font-semibold">₪{valueILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell dir="ltr" className={pnlILS >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {holding.current_price ? (
                            <>{pnlILS >= 0 ? '+' : ''}₪{pnlILS.toLocaleString(undefined, {maximumFractionDigits: 0})}</>
                          ) : '—'}
                        </TableCell>
                        <TableCell dir="ltr" className={pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {holding.current_price ? `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%` : '—'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {holding.asset_type === 'bank_savings' && (
                                <DropdownMenuItem onClick={() => setSavingsToUpdate(holding)}>
                                  <Pencil className="ml-2 h-4 w-4" />עדכן חיסכון
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => deleteHolding.mutate(holding.id)}>
                                <Trash2 className="ml-2 h-4 w-4" />מחק
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              /* Category grouped view */
              <div className="space-y-4">
                {categoryGroups.map(group => (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color || "#6b7280" }} />
                      <span className="font-semibold text-sm cursor-pointer hover:underline" onClick={() => navigate(`/category/${group.id}`)}>{group.name}</span>
                      <span className="text-xs text-muted-foreground">({group.catHoldings.length})</span>
                    </div>
                    <Table>
                      <TableBody>
                        {group.catHoldings.map(h => {
                          const cp = h.current_price ?? h.average_cost;
                          const vILS = getValueILS(h);
                          const plILS = getPnlILS(h);
                          return (
                            <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/holding/${h.id}`)}>
                              <TableCell className="font-medium" dir="ltr">{h.fund_number || h.symbol}</TableCell>
                              <TableCell>{h.name}</TableCell>
                              <TableCell dir="ltr">{h.quantity.toLocaleString()}</TableCell>
                              <TableCell dir="ltr">₪{vILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                              <TableCell dir="ltr" className={plILS >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {h.current_price ? `${plILS >= 0 ? '+' : ''}₪${plILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ))}
                {uncategorizedHoldings.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                      <span className="font-semibold text-sm text-muted-foreground">ללא קטגוריה</span>
                      <span className="text-xs text-muted-foreground">({uncategorizedHoldings.length})</span>
                    </div>
                    <Table>
                      <TableBody>
                        {uncategorizedHoldings.map(h => {
                          const vILS = getValueILS(h);
                          const plILS = getPnlILS(h);
                          return (
                            <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/holding/${h.id}`)}>
                              <TableCell className="font-medium" dir="ltr">{h.fund_number || h.symbol}</TableCell>
                              <TableCell>{h.name}</TableCell>
                              <TableCell dir="ltr">{h.quantity.toLocaleString()}</TableCell>
                              <TableCell dir="ltr">₪{vILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                              <TableCell dir="ltr" className={plILS >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {h.current_price ? `${plILS >= 0 ? '+' : ''}₪${plILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
            </CardContent>
          </Card>

          {archivedHoldings.length > 0 && (
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle className="text-base">ארכיון — נמכרו ({archivedHoldings.length})</CardTitle>
                <CardDescription>ניירות ערך שנמכרו במלואם</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">סימול</TableHead>
                      <TableHead className="text-right">שם</TableHead>
                      <TableHead className="text-right">סוג</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedHoldings.map((h) => (
                      <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/holding/${h.id}`)}>
                        <TableCell className="font-medium" dir="ltr">{h.fund_number || h.symbol}</TableCell>
                        <TableCell>{h.name}</TableCell>
                        <TableCell>{getAssetTypeLabel(h.asset_type)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          </>
        );
        })()}
      </div>
      <UpdateSavingsDialog open={!!savingsToUpdate} onOpenChange={(o) => !o && setSavingsToUpdate(null)} holding={savingsToUpdate} />
    </AppLayout>
  );
}
