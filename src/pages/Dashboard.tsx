import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, PieChart, Plus, ArrowUpLeft, ArrowDownRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Dashboard() {
  // Placeholder data - will be replaced with real data from hooks
  const portfolioStats = {
    totalValue: 0,
    totalCost: 0,
    totalGain: 0,
    totalGainPercent: 0,
    totalDividends: 0,
    holdingsCount: 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">שלום! 👋</h1>
            <p className="text-muted-foreground">סקירה כללית של הפורטפוליו שלך</p>
          </div>
          <Button asChild>
            <Link to="/invest">
              <Plus className="ml-2 h-4 w-4" />
              הוסף נייר ערך
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">שווי כולל</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₪{portfolioStats.totalValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                עלות: ₪{portfolioStats.totalCost.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">רווח/הפסד</CardTitle>
              {portfolioStats.totalGain >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${portfolioStats.totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ₪{portfolioStats.totalGain.toLocaleString()}
              </div>
              <p className={`text-xs ${portfolioStats.totalGainPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {portfolioStats.totalGainPercent >= 0 ? '+' : ''}{portfolioStats.totalGainPercent.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">דיבידנדים</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                ₪{portfolioStats.totalDividends.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                סה"כ התקבל
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ניירות ערך</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {portfolioStats.holdingsCount}
              </div>
              <p className="text-xs text-muted-foreground">
                בפורטפוליו
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>התחל עם הפורטפוליו שלך</CardTitle>
              <CardDescription>
                הוסף את ניירות הערך הראשונים שלך או ייבא נתונים מקובץ
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button asChild>
                <Link to="/invest">
                  <Plus className="ml-2 h-4 w-4" />
                  הוסף ידנית
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/import">
                  <ArrowUpLeft className="ml-2 h-4 w-4" />
                  ייבא קובץ
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>הגדר יעדי השקעה</CardTitle>
              <CardDescription>
                הגדר יעדים וטרגטים למעקב אחר ההתקדמות שלך
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link to="/goals">
                  הגדר יעדים
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
