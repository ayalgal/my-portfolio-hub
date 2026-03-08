import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useHoldings } from "@/hooks/useHoldings";
import { useDividends } from "@/hooks/useDividends";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function Visualize() {
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { dividends, isLoading: dividendsLoading } = useDividends();
  const isLoading = holdingsLoading || dividendsLoading;

  // Allocation by asset type
  const allocationMap = new Map<string, number>();
  holdings.forEach(h => {
    const value = h.quantity * h.average_cost;
    const label = { stock: "מניות", etf: "ETF", mutual_fund: "קרנות נאמנות", israeli_fund: "קרנות כספיות" }[h.asset_type] || h.asset_type;
    allocationMap.set(label, (allocationMap.get(label) || 0) + value);
  });
  const allocationData = Array.from(allocationMap.entries()).map(([name, value], i) => ({
    name, value: Math.round(value), color: COLORS[i % COLORS.length],
  }));

  // Dividends by month
  const monthMap = new Map<string, number>();
  dividends.forEach(d => {
    if (d.payment_date) {
      const date = new Date(d.payment_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + d.amount);
    }
  });
  const dividendData = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, amount]) => {
      const [y, m] = month.split('-');
      const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
      return { month: monthNames[parseInt(m) - 1], amount: Math.round(amount) };
    });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ויזואליזציה</h1>
          <p className="text-muted-foreground">גרפים וניתוח הפורטפוליו שלך</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardContent className="py-8"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            <Card><CardContent className="py-8"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>הקצאת נכסים</CardTitle>
                <CardDescription>פיזור הפורטפוליו לפי סוג נכס</CardDescription>
              </CardHeader>
              <CardContent>
                {allocationData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">אין נתונים להצגה</p>
                ) : (
                  <>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {allocationData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`₪${value.toLocaleString()}`, 'שווי']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      {allocationData.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>דיבידנדים חודשיים</CardTitle>
                <CardDescription>הכנסות מדיבידנדים לאורך הזמן</CardDescription>
              </CardHeader>
              <CardContent>
                {dividendData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">אין נתונים להצגה</p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dividendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(v) => `₪${v}`} />
                        <Tooltip formatter={(value: number) => [`₪${value.toLocaleString()}`, 'דיבידנד']} />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
