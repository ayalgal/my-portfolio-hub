import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileSpreadsheet, FileJson } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useHoldings } from "@/hooks/useHoldings";
import { useTransactions } from "@/hooks/useTransactions";
import { useDividends } from "@/hooks/useDividends";

export default function Export() {
  const [format, setFormat] = useState("csv");
  const [includeHoldings, setIncludeHoldings] = useState(true);
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [includeDividends, setIncludeDividends] = useState(true);
  const { toast } = useToast();
  const { holdings } = useHoldings();
  const { transactions } = useTransactions();
  const { dividends } = useDividends();

  const generateCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(","));
    return [headers.join(","), ...rows].join("\n");
  };

  const handleExport = () => {
    let content = "";
    const sections: string[] = [];

    if (format === "json") {
      const exportData: Record<string, unknown> = {};
      if (includeHoldings) exportData.holdings = holdings;
      if (includeTransactions) exportData.transactions = transactions;
      if (includeDividends) exportData.dividends = dividends;
      content = JSON.stringify(exportData, null, 2);
    } else {
      if (includeHoldings && holdings.length > 0) {
        sections.push("--- Holdings ---\n" + generateCSV(holdings as unknown as Record<string, unknown>[], "holdings"));
      }
      if (includeTransactions && transactions.length > 0) {
        sections.push("--- Transactions ---\n" + generateCSV(transactions as unknown as Record<string, unknown>[], "transactions"));
      }
      if (includeDividends && dividends.length > 0) {
        sections.push("--- Dividends ---\n" + generateCSV(dividends as unknown as Record<string, unknown>[], "dividends"));
      }
      content = sections.join("\n\n");
    }

    if (!content) {
      toast({ variant: "destructive", title: "אין נתונים", description: "אין נתונים לייצוא" });
      return;
    }

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio_export.${format === "json" ? "json" : "csv"}`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "הקובץ ירד בהצלחה", description: `portfolio_export.${format}` });
  };

  const FormatIcon = format === "json" ? FileJson : FileSpreadsheet;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ייצוא נתונים</h1>
          <p className="text-muted-foreground">הורד את נתוני הפורטפוליו שלך</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>הגדרות ייצוא</CardTitle>
              <CardDescription>בחר מה לכלול בקובץ ובאיזה פורמט</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>פורמט קובץ</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label>תוכן לייצוא</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox id="holdings" checked={includeHoldings} onCheckedChange={(c) => setIncludeHoldings(c === true)} />
                    <label htmlFor="holdings" className="text-sm cursor-pointer">ניירות ערך ({holdings.length})</label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox id="transactions" checked={includeTransactions} onCheckedChange={(c) => setIncludeTransactions(c === true)} />
                    <label htmlFor="transactions" className="text-sm cursor-pointer">עסקאות ({transactions.length})</label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox id="dividends" checked={includeDividends} onCheckedChange={(c) => setIncludeDividends(c === true)} />
                    <label htmlFor="dividends" className="text-sm cursor-pointer">דיבידנדים ({dividends.length})</label>
                  </div>
                </div>
              </div>
              <Button onClick={handleExport} className="w-full">
                <Download className="ml-2 h-4 w-4" />ייצא קובץ
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>תצוגה מקדימה</CardTitle>
              <CardDescription>סיכום הקובץ שייווצר</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FormatIcon className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">portfolio_export.{format}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {[includeHoldings && "החזקות", includeTransactions && "עסקאות", includeDividends && "דיבידנדים"].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
