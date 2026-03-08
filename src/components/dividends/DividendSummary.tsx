import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock } from "lucide-react";

interface DividendWithHolding {
  id: string;
  payment_date: string | null;
  ex_date: string | null;
  amount: number;
  currency: string | null;
  shares_at_payment: number | null;
  tax_withheld: number | null;
  is_israeli: boolean | null;
  holding_id: string;
  holdings: { name: string; symbol: string; quantity: number; average_cost: number } | null;
}

interface HoldingCategory {
  holding_id: string;
  category_id: string;
  allocation_categories: { name: string; color: string | null } | null;
}

const getRate = (currency: string | null) => {
  if (currency === "USD") return 3.7;
  if (currency === "EUR") return 4.0;
  if (currency === "CAD") return 2.7;
  return 1;
};

interface Props {
  dividends: DividendWithHolding[];
  holdingCategories: HoldingCategory[];
}

export function DividendSummary({ dividends, holdingCategories }: Props) {
  // Summary per holding
  const holdingSummary = useMemo(() => {
    const map = new Map<string, {
      holdingId: string; symbol: string; name: string;
      totalGross: number; totalTax: number; count: number;
    }>();
    for (const d of dividends) {
      const prev = map.get(d.holding_id);
      const grossILS = d.amount * getRate(d.currency);
      const taxILS = (d.tax_withheld || 0) * getRate(d.currency);
      if (prev) {
        prev.totalGross += grossILS; prev.totalTax += taxILS; prev.count++;
      } else {
        map.set(d.holding_id, {
          holdingId: d.holding_id, symbol: d.holdings?.symbol || "?", name: d.holdings?.name || "",
          totalGross: grossILS, totalTax: taxILS, count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalGross - a.totalGross);
  }, [dividends]);

  // Summary per category
  const categorySummary = useMemo(() => {
    const holdingToCats = new Map<string, { name: string; color: string | null; id: string }[]>();
    for (const hc of holdingCategories) {
      if (!hc.allocation_categories) continue;
      const prev = holdingToCats.get(hc.holding_id) || [];
      prev.push({ name: hc.allocation_categories.name, color: hc.allocation_categories.color, id: hc.category_id });
      holdingToCats.set(hc.holding_id, prev);
    }
    const catMap = new Map<string, { name: string; color: string | null; totalGross: number; totalTax: number; count: number; holdings: Set<string> }>();
    for (const d of dividends) {
      const cats = holdingToCats.get(d.holding_id) || [{ name: "ללא תיקייה", color: null, id: "uncategorized" }];
      const grossILS = d.amount * getRate(d.currency);
      const taxILS = (d.tax_withheld || 0) * getRate(d.currency);
      for (const cat of cats) {
        const prev = catMap.get(cat.id);
        if (prev) { prev.totalGross += grossILS; prev.totalTax += taxILS; prev.count++; prev.holdings.add(d.holding_id); }
        else catMap.set(cat.id, { name: cat.name, color: cat.color, totalGross: grossILS, totalTax: taxILS, count: 1, holdings: new Set([d.holding_id]) });
      }
    }
    return Array.from(catMap.values()).sort((a, b) => b.totalGross - a.totalGross);
  }, [dividends, holdingCategories]);

  // Forecast: estimate next dividend per holding, then aggregate monthly
  const { upcomingEstimates, monthlyForecast, totalEstimatedILS } = useMemo(() => {
    // Get all dividends per holding sorted by date
    const divsByHolding = new Map<string, DividendWithHolding[]>();
    for (const d of dividends) {
      const arr = divsByHolding.get(d.holding_id) || [];
      arr.push(d);
      divsByHolding.set(d.holding_id, arr);
    }

    const estimates: {
      holdingId: string; symbol: string; name: string;
      estimatedAmount: number; estimatedAmountILS: number; currency: string;
      shares: number; lastPerShare: number;
      lastPaymentDate: string | null; lastExDate: string | null;
      estimatedNextPayment: string | null; frequencyMonths: number;
    }[] = [];

    for (const [holdingId, hDivs] of divsByHolding) {
      const sorted = [...hDivs].filter(d => d.payment_date).sort((a, b) => a.payment_date!.localeCompare(b.payment_date!));
      if (sorted.length === 0) continue;

      const last = sorted[sorted.length - 1];
      if (!last.holdings || !last.shares_at_payment || last.shares_at_payment <= 0) continue;

      const perShare = last.amount / last.shares_at_payment;
      const currentShares = last.holdings.quantity;
      if (currentShares <= 0) continue;

      // Estimate frequency from gaps between payments
      let frequencyMonths = 3; // default quarterly
      if (sorted.length >= 2) {
        const gaps: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const d1 = new Date(sorted[i - 1].payment_date!);
          const d2 = new Date(sorted[i].payment_date!);
          const monthDiff = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
          if (monthDiff > 0 && monthDiff <= 13) gaps.push(monthDiff);
        }
        if (gaps.length > 0) {
          const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
          frequencyMonths = Math.round(avgGap);
          if (frequencyMonths < 1) frequencyMonths = 1;
        }
      }

      // Estimate next payment date
      let estimatedNextPayment: string | null = null;
      if (last.payment_date) {
        const lastDate = new Date(last.payment_date);
        lastDate.setMonth(lastDate.getMonth() + frequencyMonths);
        estimatedNextPayment = lastDate.toISOString().split("T")[0];
      }

      const estimatedAmount = perShare * currentShares;
      estimates.push({
        holdingId, symbol: last.holdings.symbol, name: last.holdings.name,
        estimatedAmount, estimatedAmountILS: estimatedAmount * getRate(last.currency),
        currency: last.currency || "USD", shares: currentShares, lastPerShare: perShare,
        lastPaymentDate: last.payment_date, lastExDate: last.ex_date || last.payment_date,
        estimatedNextPayment, frequencyMonths,
      });
    }

    estimates.sort((a, b) => {
      if (a.estimatedNextPayment && b.estimatedNextPayment) return a.estimatedNextPayment.localeCompare(b.estimatedNextPayment);
      return b.estimatedAmountILS - a.estimatedAmountILS;
    });

    // Monthly forecast: for each estimate, project 12 months
    const monthMap = new Map<string, { grossILS: number; taxILS: number; count: number }>();
    const now = new Date();
    for (const e of estimates) {
      if (!e.estimatedNextPayment) continue;
      let nextDate = new Date(e.estimatedNextPayment);
      const taxRate = e.currency === "ILS" ? 0.25 : 0.25;
      for (let i = 0; i < 12; i++) {
        if (nextDate > new Date(now.getFullYear() + 1, now.getMonth(), 1)) break;
        if (nextDate >= now) {
          const key = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
          const prev = monthMap.get(key) || { grossILS: 0, taxILS: 0, count: 0 };
          prev.grossILS += e.estimatedAmountILS;
          prev.taxILS += e.estimatedAmountILS * taxRate;
          prev.count++;
          monthMap.set(key, prev);
        }
        nextDate = new Date(nextDate);
        nextDate.setMonth(nextDate.getMonth() + e.frequencyMonths);
      }
    }

    const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
    const monthlyForecast = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [y, m] = key.split("-");
        return { key, label: `${monthNames[parseInt(m) - 1]} ${y}`, ...val, netILS: val.grossILS - val.taxILS };
      });

    const totalEstimatedILS = estimates.reduce((s, e) => s + e.estimatedAmountILS, 0);
    return { upcomingEstimates: estimates, monthlyForecast, totalEstimatedILS };
  }, [dividends]);

  const getCurrSym = (c: string) => ({ ILS: "₪", USD: "$", EUR: "€", CAD: "C$" }[c] || c);

  return (
    <div className="space-y-6">
      {/* Monthly forecast */}
      {monthlyForecast.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              צפי דיבידנדים חודשי
            </CardTitle>
            <CardDescription>
              אומדן לפי תדירות ודיבידנד אחרון × החזקה נוכחית
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">חודש</TableHead>
                  <TableHead className="text-right">מניות</TableHead>
                  <TableHead className="text-right">ברוטו (₪)</TableHead>
                  <TableHead className="text-right">מס (₪)</TableHead>
                  <TableHead className="text-right">נטו (₪)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyForecast.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell>{m.count}</TableCell>
                    <TableCell dir="ltr" className="text-green-500 font-semibold">₪{m.grossILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">₪{m.taxILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell dir="ltr" className="font-bold">₪{m.netILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>סה״כ שנתי</TableCell>
                  <TableCell></TableCell>
                  <TableCell dir="ltr" className="text-green-500">₪{monthlyForecast.reduce((s, m) => s + m.grossILS, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell dir="ltr" className="text-muted-foreground">₪{monthlyForecast.reduce((s, m) => s + m.taxILS, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell dir="ltr">₪{monthlyForecast.reduce((s, m) => s + m.netILS, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Per-holding detail forecast */}
      <Card>
        <CardHeader>
          <CardTitle>צפי לפי נייר ערך</CardTitle>
          <CardDescription>תשלום הבא צפוי לפי תדירות היסטורית</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingEstimates.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">אין מספיק נתונים לחיזוי</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">נייר ערך</TableHead>
                  <TableHead className="text-right">תדירות</TableHead>
                  <TableHead className="text-right">תאריך אחרון</TableHead>
                  <TableHead className="text-right">תאריך צפוי</TableHead>
                  <TableHead className="text-right">מניות</TableHead>
                  <TableHead className="text-right">צפי סכום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingEstimates.map((e) => (
                  <TableRow key={e.holdingId}>
                    <TableCell>
                      <Link to={`/holding/${e.holdingId}`} className="hover:underline font-medium">
                        {e.symbol} <span className="text-xs text-muted-foreground">({e.name})</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {e.frequencyMonths === 1 ? "חודשי" : e.frequencyMonths === 3 ? "רבעוני" : e.frequencyMonths === 6 ? "חצי שנתי" : e.frequencyMonths === 12 ? "שנתי" : `כל ${e.frequencyMonths} חודשים`}
                      </Badge>
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {e.lastPaymentDate ? new Date(e.lastPaymentDate).toLocaleDateString("he-IL") : "—"}
                    </TableCell>
                    <TableCell dir="ltr" className="font-medium text-primary">
                      {e.estimatedNextPayment ? new Date(e.estimatedNextPayment).toLocaleDateString("he-IL") : "—"}
                    </TableCell>
                    <TableCell dir="ltr">{e.shares.toLocaleString()}</TableCell>
                    <TableCell dir="ltr" className="font-semibold text-green-500">
                      {getCurrSym(e.currency)}{e.estimatedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="text-xs text-muted-foreground mr-1">(₪{e.estimatedAmountILS.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary tabs */}
      <Tabs defaultValue="byHolding" dir="rtl">
        <TabsList>
          <TabsTrigger value="byHolding">סיכום לפי נייר ערך</TabsTrigger>
          <TabsTrigger value="byCategory">סיכום לפי תיקייה</TabsTrigger>
        </TabsList>

        <TabsContent value="byHolding">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">נייר ערך</TableHead>
                    <TableHead className="text-right">תשלומים</TableHead>
                    <TableHead className="text-right">סה״כ ברוטו (₪)</TableHead>
                    <TableHead className="text-right">סה״כ מס (₪)</TableHead>
                    <TableHead className="text-right">סה״כ נטו (₪)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdingSummary.map((h) => (
                    <TableRow key={h.holdingId}>
                      <TableCell>
                        <Link to={`/holding/${h.holdingId}`} className="hover:underline">
                          <span className="font-medium" dir="ltr">{h.symbol}</span>
                          <span className="text-xs text-muted-foreground mr-1">({h.name})</span>
                        </Link>
                      </TableCell>
                      <TableCell>{h.count}</TableCell>
                      <TableCell dir="ltr" className="text-green-500 font-semibold">₪{h.totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">₪{h.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell dir="ltr" className="font-bold">₪{(h.totalGross - h.totalTax).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    </TableRow>
                  ))}
                  {holdingSummary.length > 1 && (
                    <TableRow className="border-t-2 font-bold">
                      <TableCell>סה״כ</TableCell>
                      <TableCell>{holdingSummary.reduce((s, h) => s + h.count, 0)}</TableCell>
                      <TableCell dir="ltr" className="text-green-500">₪{holdingSummary.reduce((s, h) => s + h.totalGross, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">₪{holdingSummary.reduce((s, h) => s + h.totalTax, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell dir="ltr">₪{holdingSummary.reduce((s, h) => s + h.totalGross - h.totalTax, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="byCategory">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תיקייה</TableHead>
                    <TableHead className="text-right">ניירות</TableHead>
                    <TableHead className="text-right">תשלומים</TableHead>
                    <TableHead className="text-right">סה״כ ברוטו (₪)</TableHead>
                    <TableHead className="text-right">סה״כ מס (₪)</TableHead>
                    <TableHead className="text-right">סה״כ נטו (₪)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorySummary.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {c.color && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />}
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{c.holdings.size}</TableCell>
                      <TableCell>{c.count}</TableCell>
                      <TableCell dir="ltr" className="text-green-500 font-semibold">₪{c.totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">₪{c.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell dir="ltr" className="font-bold">₪{(c.totalGross - c.totalTax).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
