import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, PieChart, Plus, ArrowUpLeft, ArrowDownRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useHoldings } from "@/hooks/useHoldings";
import { useDividends } from "@/hooks/useDividends";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type DisplayCurrency = 'ILS' | 'USD' | 'CAD';

const currencySymbols: Record<DisplayCurrency, string> = {
  ILS: '₪',
  USD: '$',
  CAD: 'C$',
};

export default function Dashboard() {
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { dividends, isLoading: dividendsLoading } = useDividends();
  const { profile } = useProfile();
  const { convertToILS, convertFromILS, rates, isLoading: ratesLoading } = useExchangeRates();
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('ILS');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const isLoading = holdingsLoading || dividendsLoading || ratesLoading;

  const formatAmount = (amountILS: number) => {
    const converted = convertFromILS(amountILS, displayCurrency);
    return `${currencySymbols[displayCurrency]}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  // Calculate totals in ILS first, then convert
  const totalCostILS = holdings.reduce((sum, h) => {
    const costInOrigCurrency = h.quantity * h.average_cost;
    return sum + convertToILS(costInOrigCurrency, h.currency || 'ILS');
  }, 0);

  const totalValueILS = holdings.reduce((sum, h) => {
    const price = h.current_price ?? h.average_cost;
    const valueInOrigCurrency = h.quantity * price;
    return sum + convertToILS(valueInOrigCurrency, h.currency || 'ILS');
  }, 0);

  const totalGainILS = totalValueILS - totalCostILS;
  const totalGainPercent = totalCostILS > 0 ? (totalGainILS / totalCostILS) * 100 : 0;

  const totalDividendsILS = dividends.reduce((sum, d) => {
    return sum + convertToILS(d.amount, d.currency || 'ILS');
  }, 0);

  const displayName = profile?.display_name || "";

  const hasCurrentPrices = holdings.some(h => h.current_price !== null);

  const handleRefreshPrices = async () => {
    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('fetch-prices');
      if (error) throw error;
      toast({ title: "מחירים עודכנו", description: "המחירים עודכנו בהצלחה" });
      // Refetch data
      window.location.reload();
    } catch {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן לעדכן מחירים" });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">שלום {displayName}! 👋</h1>
            <p className="text-muted-foreground">סקירה כללית של הפורטפוליו שלך</p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}>
              <TabsList>
                <TabsTrigger value="ILS">₪ שקל</TabsTrigger>
                <TabsTrigger value="USD">$ דולר</TabsTrigger>
                <TabsTrigger value="CAD">C$ קנדי</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon" onClick={handleRefreshPrices} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button asChild>
              <Link to="/invest"><Plus className="ml-2 h-4 w-4" />הוסף נייר ערך</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">שווי כולל</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold">{formatAmount(totalValueILS)}</div>
                  <p className="text-xs text-muted-foreground">עלות: {formatAmount(totalCostILS)}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">רווח/הפסד</CardTitle>
              {totalGainILS >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className={`text-2xl font-bold ${totalGainILS >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalGainILS >= 0 ? '+' : ''}{formatAmount(totalGainILS)}
                  </div>
                  <p className={`text-xs ${totalGainPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
                  </p>
                  {!hasCurrentPrices && holdings.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">לחץ ↻ לעדכון מחירים</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">דיבידנדים</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-blue-500">{formatAmount(totalDividendsILS)}</div>
                  <p className="text-xs text-muted-foreground">מ-{dividends.length} תשלומים</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ניירות ערך</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold">{holdings.length}</div>
                  <p className="text-xs text-muted-foreground">בפורטפוליו</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {holdings.length === 0 && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>התחל עם הפורטפוליו שלך</CardTitle>
                <CardDescription>הוסף את ניירות הערך הראשונים שלך או ייבא נתונים מקובץ</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button asChild>
                  <Link to="/invest"><Plus className="ml-2 h-4 w-4" />הוסף ידנית</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/import"><ArrowUpLeft className="ml-2 h-4 w-4" />ייבא קובץ</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>הגדר יעדי השקעה</CardTitle>
                <CardDescription>הגדר יעדים וטרגטים למעקב אחר ההתקדמות שלך</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link to="/goals">הגדר יעדים</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
