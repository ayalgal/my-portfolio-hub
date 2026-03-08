import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, PieChart, Plus, ArrowUpLeft, ArrowDownRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useHoldings } from "@/hooks/useHoldings";
import { useDividends } from "@/hooks/useDividends";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { dividends, isLoading: dividendsLoading } = useDividends();
  const { profile } = useProfile();

  const isLoading = holdingsLoading || dividendsLoading;

  const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * h.average_cost), 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.quantity * h.average_cost), 0);
  const totalDividends = dividends.reduce((sum, d) => sum + d.amount, 0);
  const holdingsCount = holdings.length;

  const displayName = profile?.display_name || "שלום";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">שלום {displayName}! 👋</h1>
            <p className="text-muted-foreground">סקירה כללית של הפורטפוליו שלך</p>
          </div>
          <Button asChild>
            <Link to="/invest">
              <Plus className="ml-2 h-4 w-4" />
              הוסף נייר ערך
            </Link>
          </Button>
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
                  <div className="text-2xl font-bold">₪{totalValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">עלות: ₪{totalCost.toLocaleString()}</p>
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
                  <div className="text-2xl font-bold text-blue-500">₪{totalDividends.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">סה"כ התקבל</p>
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
                  <div className="text-2xl font-bold">{holdingsCount}</div>
                  <p className="text-xs text-muted-foreground">בפורטפוליו</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">דיבידנדים</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold">{dividends.length}</div>
                  <p className="text-xs text-muted-foreground">תשלומים</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {holdingsCount === 0 && !isLoading && (
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
