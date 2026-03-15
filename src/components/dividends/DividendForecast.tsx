import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, TrendingUp } from "lucide-react";

interface DividendWithHolding {
  id: string;
  payment_date: string | null;
  amount: number;
  currency: string | null;
  shares_at_payment: number | null;
  tax_withheld: number | null;
  holding_id: string;
  holdings: { name: string; symbol: string; quantity: number; average_cost: number } | null;
}

interface Holding {
  id: string;
  name: string;
  symbol: string;
  quantity: number;
  average_cost: number;
  currency: string | null;
  current_price: number | null;
}

interface Props {
  dividends: DividendWithHolding[];
  holdings: Holding[];
}

const getCurrSym = (c: string) => ({ ILS: "₪", USD: "$", EUR: "€", CAD: "C$" }[c] || c);

const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function DividendForecast({ dividends, holdings }: Props) {
  // Analyze each holding's dividend pattern
  const holdingForecasts = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Group dividends by holding
    const byHolding = new Map<string, DividendWithHolding[]>();
    for (const d of dividends) {
      if (!d.payment_date) continue;
      const list = byHolding.get(d.holding_id) || [];
      list.push(d);
      byHolding.set(d.holding_id, list);
    }

    const forecasts: {
      holdingId: string;
      symbol: string;
      name: string;
      currency: string;
      currentShares: number;
      annualPerShare: number;
      frequency: string;
      paymentMonths: number[];
      nextPayments: { month: number; year: number; estimatedAmount: number }[];
      annualEstimate: number;
      yieldPct: number | null;
    }[] = [];

    for (const holding of holdings) {
      const divs = byHolding.get(holding.id);
      if (!divs || divs.length < 2) continue; // Need at least 2 dividends to identify pattern

      // Sort by date
      const sorted = [...divs].sort((a, b) => (a.payment_date || "").localeCompare(b.payment_date || ""));

      // Find payment months pattern
      const monthCounts = new Map<number, number>();
      for (const d of sorted) {
        const m = new Date(d.payment_date!).getMonth();
        monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
      }

      // Determine frequency
      const uniqueMonths = monthCounts.size;
      let frequency: string;
      if (uniqueMonths <= 2) frequency = "חצי שנתי";
      else if (uniqueMonths <= 4) frequency = "רבעוני";
      else if (uniqueMonths <= 6) frequency = "דו-חודשי";
      else frequency = "חודשי";

      // Get the typical payment months (months that appear most)
      const paymentMonths = Array.from(monthCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, uniqueMonths)
        .map(([m]) => m)
        .sort((a, b) => a - b);

      // Calculate average dividend per share from last year
      const oneYearAgo = new Date(currentYear - 1, currentMonth, 1);
      const recentDivs = sorted.filter(d => new Date(d.payment_date!) >= oneYearAgo);
      const divsForCalc = recentDivs.length >= 2 ? recentDivs : sorted.slice(-4);

      let totalPerShare = 0;
      for (const d of divsForCalc) {
        const shares = d.shares_at_payment || holding.quantity;
        if (shares > 0) totalPerShare += d.amount / shares;
      }

      // Annualize based on how many payments we used
      const monthSpan = divsForCalc.length > 1
        ? (new Date(divsForCalc[divsForCalc.length - 1].payment_date!).getTime() - new Date(divsForCalc[0].payment_date!).getTime()) / (1000 * 60 * 60 * 24 * 30)
        : 12;
      const annualPerShare = monthSpan > 0 ? (totalPerShare / monthSpan) * 12 : totalPerShare;

      // Project next 12 months of payments
      const nextPayments: { month: number; year: number; estimatedAmount: number }[] = [];
      const perPayment = annualPerShare * holding.quantity / (paymentMonths.length || 1);

      for (let i = 0; i < 12; i++) {
        const futureMonth = (currentMonth + i + 1) % 12;
        const futureYear = currentYear + Math.floor((currentMonth + i + 1) / 12);
        if (paymentMonths.includes(futureMonth)) {
          nextPayments.push({
            month: futureMonth,
            year: futureYear,
            estimatedAmount: perPayment,
          });
        }
      }

      const annualEstimate = annualPerShare * holding.quantity;
      const totalCost = holding.average_cost * holding.quantity;
      const yieldPct = totalCost > 0 ? (annualEstimate / totalCost) * 100 : null;

      forecasts.push({
        holdingId: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        currency: holding.currency || "USD",
        currentShares: holding.quantity,
        annualPerShare,
        frequency,
        paymentMonths,
        nextPayments,
        annualEstimate,
        yieldPct,
      });
    }

    return forecasts.sort((a, b) => b.annualEstimate - a.annualEstimate);
  }, [dividends, holdings]);

  // Aggregate monthly forecast
  const monthlyForecast = useMemo(() => {
    const now = new Date();
    const months: { month: number; year: number; label: string; total: number; holdings: string[] }[] = [];

    for (let i = 1; i <= 12; i++) {
      const m = (now.getMonth() + i) % 12;
      const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      let total = 0;
      const holdingSymbols: string[] = [];

      for (const f of holdingForecasts) {
        for (const p of f.nextPayments) {
          if (p.month === m && p.year === y) {
            total += p.estimatedAmount;
            holdingSymbols.push(f.symbol);
          }
        }
      }

      if (total > 0) {
        months.push({ month: m, year: y, label: `${monthNames[m]} ${y}`, total, holdings: holdingSymbols });
      }
    }

    return months;
  }, [holdingForecasts]);

  const totalAnnualForecast = holdingForecasts.reduce((s, f) => s + f.annualEstimate, 0);

  if (holdingForecasts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>אין מספיק נתוני דיבידנד להצגת צפי</p>
          <p className="text-xs mt-1">נדרשים לפחות 2 תשלומי דיבידנד לכל נייר ערך</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monthly forecast timeline */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            צפי דיבידנדים — 12 חודשים קדימה
          </CardTitle>
          <CardDescription>
            הערכה בלבד, מבוססת על תדירות ותשלומים היסטוריים. סה״כ שנתי משוער: <span className="font-semibold text-foreground">${totalAnnualForecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">חודש</TableHead>
                <TableHead className="text-right">סכום משוער</TableHead>
                <TableHead className="text-right">ני״ע משלמים</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyForecast.map((m) => (
                <TableRow key={`${m.month}-${m.year}`}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell dir="ltr" className="text-amber-600 dark:text-amber-400 font-semibold">
                    ${m.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {m.holdings.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {monthlyForecast.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    אין צפי לחודשים הקרובים
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per-holding forecast details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            פירוט צפי לפי נייר ערך
          </CardTitle>
          <CardDescription>תדירות תשלום, תשואת דיבידנד משוערת וסכום שנתי</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">נייר ערך</TableHead>
                <TableHead className="text-right">תדירות</TableHead>
                <TableHead className="text-right">חודשי תשלום</TableHead>
                <TableHead className="text-right">מניות</TableHead>
                <TableHead className="text-right">צפי שנתי</TableHead>
                <TableHead className="text-right">תשואה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdingForecasts.map((f) => {
                const curr = getCurrSym(f.currency);
                return (
                  <TableRow key={f.holdingId}>
                    <TableCell>
                      <Link to={`/holding/${f.holdingId}`} className="hover:underline font-medium">
                        {f.symbol} <span className="text-xs text-muted-foreground">({f.name})</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{f.frequency}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f.paymentMonths.map(m => monthNames[m].slice(0, 3)).join(", ")}
                    </TableCell>
                    <TableCell dir="ltr">{f.currentShares.toLocaleString()}</TableCell>
                    <TableCell dir="ltr" className="font-semibold text-amber-600 dark:text-amber-400">
                      {curr}{f.annualEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell dir="ltr">
                      {f.yieldPct !== null ? (
                        <span className={f.yieldPct >= 3 ? "text-green-500 font-semibold" : ""}>
                          {f.yieldPct.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ הצפי מבוסס על נתוני דיבידנד היסטוריים ואינו מהווה המלצה. הסכומים עשויים להשתנות.
      </p>
    </div>
  );
}
