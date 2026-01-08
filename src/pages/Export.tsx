import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileSpreadsheet, FileText, FileJson } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Export() {
  const [format, setFormat] = useState("csv");
  const [includeHoldings, setIncludeHoldings] = useState(true);
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [includeDividends, setIncludeDividends] = useState(true);
  const { toast } = useToast();

  const handleExport = () => {
    // TODO: Generate and download file
    toast({
      title: "ייצוא בתהליך",
      description: `הקובץ ב-${format.toUpperCase()} יורד בקרוב`,
    });
  };

  const getFormatIcon = (fmt: string) => {
    switch (fmt) {
      case 'csv':
      case 'xlsx':
        return FileSpreadsheet;
      case 'pdf':
        return FileText;
      case 'json':
        return FileJson;
      default:
        return FileSpreadsheet;
    }
  };

  const FormatIcon = getFormatIcon(format);

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
              <CardDescription>
                בחר מה לכלול בקובץ ובאיזה פורמט
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>פורמט קובץ</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>תוכן לייצוא</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox 
                      id="holdings" 
                      checked={includeHoldings}
                      onCheckedChange={(checked) => setIncludeHoldings(checked === true)}
                    />
                    <label htmlFor="holdings" className="text-sm cursor-pointer">
                      ניירות ערך והחזקות
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox 
                      id="transactions" 
                      checked={includeTransactions}
                      onCheckedChange={(checked) => setIncludeTransactions(checked === true)}
                    />
                    <label htmlFor="transactions" className="text-sm cursor-pointer">
                      היסטוריית עסקאות
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox 
                      id="dividends" 
                      checked={includeDividends}
                      onCheckedChange={(checked) => setIncludeDividends(checked === true)}
                    />
                    <label htmlFor="dividends" className="text-sm cursor-pointer">
                      דיבידנדים
                    </label>
                  </div>
                </div>
              </div>

              <Button onClick={handleExport} className="w-full">
                <Download className="ml-2 h-4 w-4" />
                ייצא קובץ
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>תצוגה מקדימה</CardTitle>
              <CardDescription>
                סיכום הקובץ שייווצר
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FormatIcon className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">portfolio_export.{format}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {[
                      includeHoldings && "החזקות",
                      includeTransactions && "עסקאות",
                      includeDividends && "דיבידנדים",
                    ].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">פורמט:</span>
                    <span className="mr-2 font-medium">{format.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">סעיפים:</span>
                    <span className="mr-2 font-medium">
                      {[includeHoldings, includeTransactions, includeDividends].filter(Boolean).length}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
