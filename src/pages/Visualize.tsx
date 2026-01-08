import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";

// Placeholder data
const allocationData = [
  { name: "מניות ארה״ב", value: 40, color: "#3b82f6" },
  { name: "קרנות כספיות", value: 25, color: "#10b981" },
  { name: "ETF בינלאומי", value: 20, color: "#f59e0b" },
  { name: "מניות ישראל", value: 15, color: "#8b5cf6" },
];

const performanceData = [
  { month: "ינו", value: 100000 },
  { month: "פבר", value: 102500 },
  { month: "מרץ", value: 98000 },
  { month: "אפר", value: 105000 },
  { month: "מאי", value: 110000 },
  { month: "יוני", value: 108500 },
];

const dividendData = [
  { month: "ינו", amount: 150 },
  { month: "פבר", amount: 200 },
  { month: "מרץ", amount: 180 },
  { month: "אפר", amount: 320 },
  { month: "מאי", amount: 250 },
  { month: "יוני", amount: 280 },
];

export default function Visualize() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ויזואליזציה</h1>
          <p className="text-muted-foreground">גרפים וניתוח הפורטפוליו שלך</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Allocation Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>הקצאת נכסים</CardTitle>
              <CardDescription>פיזור הפורטפוליו לפי סוג נכס</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, 'הקצאה']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {allocationData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle>ביצועים לאורך זמן</CardTitle>
              <CardDescription>שווי הפורטפוליו ב-6 חודשים אחרונים</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" />
                    <YAxis 
                      tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`₪${value.toLocaleString()}`, 'שווי']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Dividend Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>דיבידנדים חודשיים</CardTitle>
              <CardDescription>הכנסות מדיבידנדים לאורך השנה</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dividendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `₪${value}`} />
                    <Tooltip 
                      formatter={(value: number) => [`₪${value.toLocaleString()}`, 'דיבידנד']}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
