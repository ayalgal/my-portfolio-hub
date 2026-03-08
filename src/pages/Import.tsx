import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHoldings } from "@/hooks/useHoldings";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ParsedRow {
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  asset_type: string;
  currency: string;
}

export default function Import() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsed' | 'error' | 'importing' | 'done'>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const { toast } = useToast();
  const { portfolios } = usePortfolio();
  const { createHolding } = useHoldings();

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    
    // Try to auto-detect columns
    const symbolIdx = headers.findIndex(h => ['symbol', 'סימול', 'ticker', 'סימבול'].includes(h));
    const nameIdx = headers.findIndex(h => ['name', 'שם', 'company', 'חברה', 'שם נייר'].includes(h));
    const qtyIdx = headers.findIndex(h => ['quantity', 'כמות', 'shares', 'qty', 'יחידות'].includes(h));
    const costIdx = headers.findIndex(h => ['average_cost', 'cost', 'price', 'מחיר', 'עלות', 'עלות ממוצעת', 'שער'].includes(h));
    const currIdx = headers.findIndex(h => ['currency', 'מטבע', 'curr'].includes(h));
    const typeIdx = headers.findIndex(h => ['type', 'asset_type', 'סוג', 'סוג נכס'].includes(h));

    if (symbolIdx === -1 || qtyIdx === -1) return [];

    return lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
      return {
        symbol: cols[symbolIdx] || '',
        name: nameIdx >= 0 ? cols[nameIdx] : cols[symbolIdx],
        quantity: parseFloat(cols[qtyIdx]) || 0,
        average_cost: costIdx >= 0 ? (parseFloat(cols[costIdx]) || 0) : 0,
        currency: currIdx >= 0 ? cols[currIdx] : 'ILS',
        asset_type: typeIdx >= 0 ? cols[typeIdx] : 'stock',
      };
    }).filter(r => r.symbol && r.quantity > 0);
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
    if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
      toast({ variant: "destructive", title: "קובץ לא נתמך", description: "כרגע נתמך רק CSV" });
      setStatus('error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast({ variant: "destructive", title: "שגיאה בקריאת הקובץ", description: "לא נמצאו שורות תקינות. ודא שהקובץ מכיל עמודות symbol וquantity" });
        setStatus('error');
        return;
      }
      setParsedRows(rows);
      setFile(file);
      setStatus('parsed');
      toast({ title: `נמצאו ${rows.length} שורות`, description: "בדוק את הנתונים ולחץ ייבא" });
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const portfolioId = portfolios?.[0]?.id;
    if (!portfolioId || parsedRows.length === 0) return;

    setStatus('importing');
    let success = 0;
    let failed = 0;

    for (const row of parsedRows) {
      try {
        await createHolding.mutateAsync({
          symbol: row.symbol,
          name: row.name,
          quantity: row.quantity,
          average_cost: row.average_cost,
          asset_type: row.asset_type,
          currency: row.currency,
          portfolio_id: portfolioId,
        });
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ייבוא נתונים</h1>
          <p className="text-muted-foreground">ייבא נתוני פורטפוליו מקובץ CSV</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>העלה קובץ</CardTitle>
                <CardDescription>גרור קובץ CSV לכאן, או לחץ לבחירת קובץ</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors
                    ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                    ${status === 'parsed' || status === 'done' ? 'border-green-500 bg-green-500/5' : ''}
                    ${status === 'error' ? 'border-red-500 bg-red-500/5' : ''}
                  `}
                >
                  {status === 'parsed' && file ? (
                    <div className="space-y-4">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{parsedRows.length} שורות נמצאו</p>
                      </div>
                      <Button onClick={handleImport}>ייבא {parsedRows.length} ניירות ערך</Button>
                    </div>
                  ) : status === 'importing' ? (
                    <div className="space-y-4">
                      <Upload className="w-12 h-12 text-primary mx-auto animate-pulse" />
                      <p className="font-medium">מייבא נתונים...</p>
                    </div>
                  ) : status === 'done' ? (
                    <div className="space-y-4">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                      <p className="font-medium text-green-500">ייבוא הושלם בהצלחה!</p>
                      <Button variant="outline" onClick={() => { setStatus('idle'); setParsedRows([]); setFile(null); }}>ייבא קובץ נוסף</Button>
                    </div>
                  ) : status === 'error' ? (
                    <div className="space-y-4">
                      <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                      <p className="text-red-500">שגיאה בטעינת הקובץ</p>
                      <Button variant="outline" onClick={() => setStatus('idle')}>נסה שוב</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                      <div>
                        <p className="font-medium">גרור קובץ לכאן</p>
                        <p className="text-sm text-muted-foreground">או לחץ לבחירת קובץ</p>
                      </div>
                      <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="file-upload" />
                      <Button variant="outline" asChild>
                        <label htmlFor="file-upload" className="cursor-pointer">בחר קובץ</label>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {parsedRows.length > 0 && status === 'parsed' && (
              <Card>
                <CardHeader>
                  <CardTitle>תצוגה מקדימה ({parsedRows.length} שורות)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">סימול</TableHead>
                        <TableHead className="text-right">שם</TableHead>
                        <TableHead className="text-right">כמות</TableHead>
                        <TableHead className="text-right">עלות</TableHead>
                        <TableHead className="text-right">מטבע</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell dir="ltr" className="font-medium">{row.symbol}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell dir="ltr">{row.quantity}</TableCell>
                          <TableCell dir="ltr">{row.average_cost}</TableCell>
                          <TableCell>{row.currency}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedRows.length > 10 && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">ועוד {parsedRows.length - 10} שורות...</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5" />איך לייבא?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <p className="font-medium">1. פורמט הקובץ</p>
                  <p className="text-muted-foreground">CSV עם עמודות: symbol, name, quantity, cost, currency</p>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">2. דוגמה</p>
                  <pre className="text-xs bg-muted p-2 rounded" dir="ltr">
{`symbol,name,quantity,cost,currency
AAPL,Apple Inc.,10,150.00,USD
POLI,בנק הפועלים,500,30.50,ILS`}
                  </pre>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">3. העלה ובדוק</p>
                  <p className="text-muted-foreground">גרור את הקובץ, בדוק את הנתונים ולחץ ייבא</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />עמודות נתמכות</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>symbol / סימול (חובה)</li>
                  <li>name / שם</li>
                  <li>quantity / כמות (חובה)</li>
                  <li>cost / עלות / מחיר</li>
                  <li>currency / מטבע</li>
                  <li>type / סוג נכס</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
