import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Import() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (file: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      toast({
        variant: "destructive",
        title: "קובץ לא נתמך",
        description: "יש להעלות קובץ CSV או Excel",
      });
      setStatus('error');
      return;
    }
    
    setFile(file);
    setStatus('success');
    toast({
      title: "קובץ נטען בהצלחה",
      description: `${file.name} מוכן לעיבוד`,
    });
  };

  const handleImport = () => {
    if (!file) return;
    
    // TODO: Process the file and import data
    toast({
      title: "ייבוא בתהליך",
      description: "הנתונים ייובאו לפורטפוליו שלך",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ייבוא נתונים</h1>
          <p className="text-muted-foreground">ייבא נתוני פורטפוליו מקובץ CSV או Excel</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Area */}
            <Card>
              <CardHeader>
                <CardTitle>העלה קובץ</CardTitle>
                <CardDescription>
                  גרור קובץ CSV או Excel לכאן, או לחץ לבחירת קובץ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    border-2 border-dashed rounded-lg p-12 text-center transition-colors
                    ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                    ${status === 'success' ? 'border-green-500 bg-green-500/5' : ''}
                    ${status === 'error' ? 'border-red-500 bg-red-500/5' : ''}
                  `}
                >
                  {status === 'success' && file ? (
                    <div className="space-y-4">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button onClick={handleImport}>
                        ייבא נתונים
                      </Button>
                    </div>
                  ) : status === 'error' ? (
                    <div className="space-y-4">
                      <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                      <p className="text-red-500">שגיאה בטעינת הקובץ</p>
                      <Button variant="outline" onClick={() => setStatus('idle')}>
                        נסה שוב
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                      <div>
                        <p className="font-medium">גרור קובץ לכאן</p>
                        <p className="text-sm text-muted-foreground">או לחץ לבחירת קובץ</p>
                      </div>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button variant="outline" asChild>
                        <label htmlFor="file-upload" className="cursor-pointer">
                          בחר קובץ
                        </label>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  איך לייבא?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <p className="font-medium">1. ייצא מהבנק</p>
                  <p className="text-muted-foreground">
                    היכנס לאתר הבנק/ברוקר שלך וייצא את דף ניירות הערך
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">2. פורמט הקובץ</p>
                  <p className="text-muted-foreground">
                    וודא שהקובץ בפורמט CSV או Excel
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">3. העלה כאן</p>
                  <p className="text-muted-foreground">
                    גרור את הקובץ או לחץ לבחירה
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  פורמטים נתמכים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    CSV (.csv)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Excel (.xlsx, .xls)
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
