import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, HelpCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHoldings } from "@/hooks/useHoldings";
import { useTransactions } from "@/hooks/useTransactions";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useAllocations } from "@/hooks/useAllocations";
import { useHoldingCategories } from "@/hooks/useHoldingCategories";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

interface RawRow {
  portfolioName: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  purchaseDate: string;
  purchasePrice: number;
  sellDate: string | null;
  sellPrice: number | null;
  shareCount: number;
  currentPrice: number | null;
  folder: string;
}

interface AggregatedHolding {
  symbol: string;
  name: string;
  currency: string;
  assetType: string;
  fundNumber: string | null;
  totalQuantity: number;
  weightedAvgCost: number;
  currentPrice: number | null;
  folder: string;
  buys: { date: string; price: number; quantity: number }[];
  sells: { date: string; price: number; quantity: number }[];
  selected: boolean;
}

function detectAssetType(row: RawRow): string {
  // Israeli funds: 7-digit number on TASE
  if (row.exchange === "TASE" && /^\d{7}$/.test(row.symbol)) return "israeli_fund";
  if (row.name.toLowerCase().includes("etf") || row.exchange === "ARCX" || row.exchange === "BATS") return "etf";
  return "stock";
}

function parseDonatelloXLSX(data: any[][]): RawRow[] {
  if (data.length < 2) return [];
  
  const headers = data[0].map((h: any) => String(h || "").trim());
  
  // Map column indices
  const colMap: Record<string, number> = {};
  const knownCols: Record<string, string[]> = {
    portfolioName: ["Portfolio Name"],
    symbol: ["Symbol"],
    name: ["Security Name"],
    exchange: ["Exchange"],
    currency: ["Currency"],
    purchaseDate: ["Purchase Date"],
    purchasePrice: ["Purchase Price"],
    sellDate: ["Sell Date"],
    sellPrice: ["Sell Price"],
    shareCount: ["Share Count"],
    currentPrice: ["Current Price"],
    folder: ["Folder"],
  };

  for (const [key, candidates] of Object.entries(knownCols)) {
    const idx = headers.findIndex(h => candidates.some(c => h.toLowerCase() === c.toLowerCase()));
    if (idx >= 0) colMap[key] = idx;
  }

  if (colMap.symbol === undefined || colMap.shareCount === undefined) return [];

  return data.slice(1).map(row => ({
    portfolioName: row[colMap.portfolioName] || "",
    symbol: String(row[colMap.symbol] || "").trim(),
    name: String(row[colMap.name] || row[colMap.symbol] || "").trim(),
    exchange: String(row[colMap.exchange] || "").trim(),
    currency: String(row[colMap.currency] || "USD").trim(),
    purchaseDate: row[colMap.purchaseDate] ? String(row[colMap.purchaseDate]) : "",
    purchasePrice: parseFloat(row[colMap.purchasePrice]) || 0,
    sellDate: row[colMap.sellDate] ? String(row[colMap.sellDate]) : null,
    sellPrice: row[colMap.sellPrice] ? parseFloat(row[colMap.sellPrice]) : null,
    shareCount: parseFloat(row[colMap.shareCount]) || 0,
    currentPrice: row[colMap.currentPrice] ? parseFloat(row[colMap.currentPrice]) : null,
    folder: String(row[colMap.folder] || "").trim(),
  })).filter(r => r.symbol && r.shareCount > 0);
}

function aggregateRows(rows: RawRow[]): AggregatedHolding[] {
  const grouped: Record<string, RawRow[]> = {};
  
  for (const row of rows) {
    if (!grouped[row.symbol]) grouped[row.symbol] = [];
    grouped[row.symbol].push(row);
  }

  return Object.entries(grouped).map(([symbol, symbolRows]) => {
    const first = symbolRows[0];
    const assetType = detectAssetType(first);
    
    // Separate buys (no sell date) and sells (has sell date)
    const buys: { date: string; price: number; quantity: number }[] = [];
    const sells: { date: string; price: number; quantity: number }[] = [];
    
    for (const row of symbolRows) {
      if (row.sellDate && row.sellPrice) {
        sells.push({ date: row.sellDate, price: row.sellPrice, quantity: row.shareCount });
      }
      // Always record the buy
      buys.push({ date: row.purchaseDate, price: row.purchasePrice, quantity: row.shareCount });
    }

    // Calculate active holdings: buys without sells
    const activeBuys = symbolRows.filter(r => !r.sellDate || !r.sellPrice);
    const totalQuantity = activeBuys.reduce((sum, r) => sum + r.shareCount, 0);
    const totalCost = activeBuys.reduce((sum, r) => sum + r.shareCount * r.purchasePrice, 0);
    let weightedAvgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    let currentPrice = first.currentPrice;

    // Israeli funds are priced in agorot (1/100 of ILS) — convert to ILS
    if (assetType === "israeli_fund") {
      weightedAvgCost = weightedAvgCost / 100;
      currentPrice = currentPrice ? currentPrice / 100 : null;
    }

    return {
      symbol,
      name: first.name,
      currency: first.currency,
      assetType,
      fundNumber: assetType === "israeli_fund" ? symbol : null,
      totalQuantity,
      weightedAvgCost,
      currentPrice,
      folder: first.folder,
      buys,
      sells,
      selected: totalQuantity > 0,
    };
  });
}

function parseCSV(text: string): AggregatedHolding[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
  const symbolIdx = headers.findIndex(h => ['symbol', 'סימול', 'ticker'].includes(h));
  const nameIdx = headers.findIndex(h => ['name', 'שם', 'security name'].includes(h));
  const qtyIdx = headers.findIndex(h => ['quantity', 'כמות', 'shares', 'share count'].includes(h));
  const costIdx = headers.findIndex(h => ['average_cost', 'cost', 'price', 'purchase price', 'מחיר', 'עלות'].includes(h));
  const currIdx = headers.findIndex(h => ['currency', 'מטבע'].includes(h));

  if (symbolIdx === -1 || qtyIdx === -1) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    const symbol = cols[symbolIdx] || '';
    const qty = parseFloat(cols[qtyIdx]) || 0;
    const cost = costIdx >= 0 ? parseFloat(cols[costIdx]) || 0 : 0;
    return {
      symbol,
      name: nameIdx >= 0 ? cols[nameIdx] : symbol,
      currency: currIdx >= 0 ? cols[currIdx] : 'USD',
      assetType: /^\d{7}$/.test(symbol) ? 'israeli_fund' : 'stock',
      fundNumber: /^\d{7}$/.test(symbol) ? symbol : null,
      totalQuantity: qty,
      weightedAvgCost: cost,
      currentPrice: null,
      folder: '',
      buys: [{ date: '', price: cost, quantity: qty }],
      sells: [],
      selected: qty > 0,
    };
  }).filter(r => r.symbol && r.totalQuantity > 0);
}

const getCurrencySymbol = (c: string) => ({ ILS: "₪", USD: "$", CAD: "C$", EUR: "€" }[c] || c);

export default function Import() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsed' | 'error' | 'importing' | 'done'>('idle');
  const [aggregated, setAggregated] = useState<AggregatedHolding[]>([]);
  const { toast } = useToast();
  const { portfolios, createPortfolio } = usePortfolio();
  const { createHolding } = useHoldings();
  const { createTransaction } = useTransactions();
  const { categories, createCategory } = useAllocations();
  const { assignCategory } = useHoldingCategories();
  const { user } = useAuth();

  const toggleSelect = (symbol: string) => {
    setAggregated(prev => prev.map(h => h.symbol === symbol ? { ...h, selected: !h.selected } : h));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = (file: File) => {
    const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCSV = file.name.endsWith('.csv') || file.type.includes('csv');

    if (!isXLSX && !isCSV) {
      toast({ variant: "destructive", title: "קובץ לא נתמך", description: "נתמכים: XLSX, XLS, CSV" });
      setStatus('error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let holdings: AggregatedHolding[];

        if (isXLSX) {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          const rawRows = parseDonatelloXLSX(jsonData);
          holdings = aggregateRows(rawRows);
        } else {
          const text = e.target?.result as string;
          holdings = parseCSV(text);
        }

        if (holdings.length === 0) {
          toast({ variant: "destructive", title: "לא נמצאו נתונים", description: "ודא שהקובץ בפורמט הנכון" });
          setStatus('error');
          return;
        }

        setAggregated(holdings);
        setFile(file);
        setStatus('parsed');
        
        const activeCount = holdings.filter(h => h.totalQuantity > 0).length;
        const soldCount = holdings.filter(h => h.totalQuantity === 0).length;
        toast({
          title: `נמצאו ${holdings.length} ניירות ערך`,
          description: `${activeCount} פעילים${soldCount > 0 ? `, ${soldCount} נמכרו` : ''}`,
        });
      } catch (err) {
        console.error('Parse error:', err);
        toast({ variant: "destructive", title: "שגיאה בקריאת הקובץ", description: "הקובץ לא תקין" });
        setStatus('error');
      }
    };

    if (isXLSX) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleImport = async () => {
    let portfolioId = portfolios?.[0]?.id;
    
    // Auto-create a default portfolio if none exists
    if (!portfolioId) {
      try {
        const result = await createPortfolio.mutateAsync({ name: "הפורטפוליו שלי", currency: "ILS" });
        portfolioId = result.id;
      } catch {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן ליצור פורטפוליו" });
        return;
      }
    }

    const selected = aggregated.filter(h => h.selected && h.totalQuantity > 0);
    if (selected.length === 0) return;

    setStatus('importing');
    let success = 0;
    let failed = 0;

    // Pre-fetch existing categories to avoid duplicates
    const { data: existingCats } = await supabase
      .from("allocation_categories")
      .select("*")
      .eq("user_id", user!.id);
    const categoryCache: Record<string, string> = {};
    for (const cat of existingCats || []) {
      categoryCache[cat.name] = cat.id;
    }

    for (const holding of selected) {
      try {
        const result = await createHolding.mutateAsync({
          symbol: holding.fundNumber || holding.symbol,
          name: holding.name,
          quantity: holding.totalQuantity,
          average_cost: holding.weightedAvgCost,
          asset_type: holding.assetType,
          currency: holding.currency,
          portfolio_id: portfolioId,
          fund_number: holding.fundNumber,
          current_price: holding.currentPrice,
        });

        // Create buy transactions for each purchase
        const isIsraeliFund = holding.assetType === "israeli_fund";
        for (const buy of holding.buys) {
          // Skip buys that were sold (they appear in sells too)
          const wasSold = holding.sells.some(s => s.date && s.quantity === buy.quantity && s.price);
          if (wasSold) continue;
          
          const price = isIsraeliFund ? buy.price / 100 : buy.price;
          try {
            await createTransaction.mutateAsync({
              holding_id: result.id,
              transaction_type: "buy",
              quantity: buy.quantity,
              price: price,
              total_amount: buy.quantity * price,
              transaction_date: buy.date ? buy.date.split("T")[0] : new Date().toISOString().split("T")[0],
              currency: holding.currency,
              notes: "יובא מ-Donatello",
            });
          } catch {
            // Transaction creation is best-effort
          }
        }

        // Create sell transactions
        for (const sell of holding.sells) {
          const price = isIsraeliFund ? sell.price / 100 : sell.price;
          try {
            await createTransaction.mutateAsync({
              holding_id: result.id,
              transaction_type: "sell",
              quantity: sell.quantity,
              price: price,
              total_amount: sell.quantity * price,
              transaction_date: sell.date ? sell.date.split("T")[0] : new Date().toISOString().split("T")[0],
              currency: holding.currency,
              notes: "יובא מ-Donatello",
            });
          } catch {
            // Transaction creation is best-effort
          }
        }

        // Assign category based on folder name from Donatello
        if (holding.folder && user?.id) {
          try {
            let cat = categories.find(c => c.name === holding.folder);
            if (!cat) {
              cat = await createCategory.mutateAsync({ name: holding.folder });
            }
            if (cat) {
              await assignCategory.mutateAsync({ holdingId: result.id, categoryId: cat.id });
            }
          } catch {
            // Category assignment is best-effort
          }
        }

        success++;
      } catch {
        failed++;
      }
    }

    setStatus('done');
    toast({
      title: "ייבוא הושלם",
      description: `${success} ניירות ערך יובאו${failed > 0 ? `, ${failed} נכשלו` : ''}`,
    });
  };

  const selectedCount = aggregated.filter(h => h.selected).length;
  const activeHoldings = aggregated.filter(h => h.totalQuantity > 0);
  const soldHoldings = aggregated.filter(h => h.totalQuantity === 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ייבוא נתונים</h1>
          <p className="text-muted-foreground">ייבא נתוני פורטפוליו מקובץ XLSX או CSV</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>העלה קובץ</CardTitle>
                <CardDescription>גרור קובץ XLSX / CSV לכאן, או לחץ לבחירת קובץ</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors
                    ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                    ${status === 'parsed' || status === 'done' ? 'border-primary bg-primary/5' : ''}
                    ${status === 'error' ? 'border-destructive bg-destructive/5' : ''}
                  `}
                >
                  {status === 'parsed' && file ? (
                    <div className="space-y-4">
                      <CheckCircle className="w-12 h-12 text-primary mx-auto" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {activeHoldings.length} ניירות ערך פעילים
                          {soldHoldings.length > 0 && `, ${soldHoldings.length} נמכרו`}
                        </p>
                      </div>
                      <Button onClick={handleImport} disabled={selectedCount === 0}>
                        ייבא {selectedCount} ניירות ערך נבחרים
                      </Button>
                    </div>
                  ) : status === 'importing' ? (
                    <div className="space-y-4">
                      <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
                      <p className="font-medium">מייבא נתונים...</p>
                    </div>
                  ) : status === 'done' ? (
                    <div className="space-y-4">
                      <CheckCircle className="w-12 h-12 text-primary mx-auto" />
                      <p className="font-medium text-primary">ייבוא הושלם בהצלחה!</p>
                      <Button variant="outline" onClick={() => { setStatus('idle'); setAggregated([]); setFile(null); }}>ייבא קובץ נוסף</Button>
                    </div>
                  ) : status === 'error' ? (
                    <div className="space-y-4">
                      <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                      <p className="text-destructive">שגיאה בטעינת הקובץ</p>
                      <Button variant="outline" onClick={() => setStatus('idle')}>נסה שוב</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                      <div>
                        <p className="font-medium">גרור קובץ לכאן</p>
                        <p className="text-sm text-muted-foreground">XLSX, XLS, CSV</p>
                      </div>
                      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" id="file-upload" />
                      <Button variant="outline" asChild>
                        <label htmlFor="file-upload" className="cursor-pointer">בחר קובץ</label>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {aggregated.length > 0 && status === 'parsed' && (
              <>
                {activeHoldings.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>החזקות פעילות ({activeHoldings.length})</CardTitle>
                      <CardDescription>בחר אילו ניירות ערך לייבא</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="text-right">סימול</TableHead>
                            <TableHead className="text-right">שם</TableHead>
                            <TableHead className="text-right">סוג</TableHead>
                            <TableHead className="text-right">כמות</TableHead>
                            <TableHead className="text-right">עלות ממוצעת</TableHead>
                            <TableHead className="text-right">מטבע</TableHead>
                            <TableHead className="text-right">תיקייה</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeHoldings.map((h) => (
                            <TableRow key={h.symbol} className={h.selected ? '' : 'opacity-50'}>
                              <TableCell>
                                <Checkbox
                                  checked={h.selected}
                                  onCheckedChange={() => toggleSelect(h.symbol)}
                                />
                              </TableCell>
                              <TableCell dir="ltr" className="font-medium">{h.symbol}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{h.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {h.assetType === 'israeli_fund' ? 'קרן כספית' : h.assetType === 'etf' ? 'ETF' : 'מניה'}
                                </Badge>
                              </TableCell>
                              <TableCell dir="ltr">{h.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell dir="ltr">{getCurrencySymbol(h.currency)}{h.weightedAvgCost.toFixed(2)}</TableCell>
                              <TableCell>{h.currency}</TableCell>
                              <TableCell>{h.folder}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {soldHoldings.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-muted-foreground">נמכרו ({soldHoldings.length})</CardTitle>
                      <CardDescription>ניירות ערך שנמכרו במלואם — לא ייובאו</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">סימול</TableHead>
                            <TableHead className="text-right">שם</TableHead>
                            <TableHead className="text-right">קניות</TableHead>
                            <TableHead className="text-right">מכירות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {soldHoldings.map((h) => (
                            <TableRow key={h.symbol} className="opacity-50">
                              <TableCell dir="ltr" className="font-medium">{h.symbol}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{h.name}</TableCell>
                              <TableCell dir="ltr">{h.buys.length}</TableCell>
                              <TableCell dir="ltr">{h.sells.length}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5" />פורמטים נתמכים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <p className="font-medium flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Donatello Export (XLSX)
                  </p>
                  <p className="text-muted-foreground">
                    ייצוא ישיר מ-Donatello. כולל זיהוי אוטומטי של קרנות כספיות, חישוב עלות ממוצעת משוקללת, וזיהוי מכירות.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="font-medium flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    CSV
                  </p>
                  <p className="text-muted-foreground">
                    עמודות: symbol, name, quantity, cost, currency
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />מה מיובא?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>✅ סימול, שם ונתוני קנייה</p>
                <p>✅ מספר קרן לקרנות ישראליות</p>
                <p>✅ חישוב עלות ממוצעת משוקללת</p>
                <p>✅ סוג נכס (מניה, ETF, קרן כספית)</p>
                <p>✅ מטבע (USD / ILS)</p>
                <p>⚪ ניירות שנמכרו לא מיובאים</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
