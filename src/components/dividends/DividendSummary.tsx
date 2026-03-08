import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

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
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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

  // Available years
  const years = useMemo(() => {
    const yrs = new Set<number>();
    dividends.forEach(d => { if (d.payment_date) yrs.add(new Date(d.payment_date).getFullYear()); });
    return Array.from(yrs).sort((a, b) => b - a);
  }, [dividends]);

  // Monthly history for selected year (real data only)
  const monthlyHistory = useMemo(() => {
    const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
    const result = monthNames.map((name, i) => ({
      label: `${name} ${selectedYear}`,
      month: i,
      grossILS: 0,
      taxILS: 0,
      netILS: 0,
      count: 0,
      holdings: new Set<string>(),
    }));

    for (const d of dividends) {
      if (!d.payment_date) continue;
      const date = new Date(d.payment_date);
      if (date.getFullYear() !== selectedYear) continue;
      const monthIdx = date.getMonth();
      const grossILS = d.amount * getRate(d.currency);
      const taxILS = (d.tax_withheld || 0) * getRate(d.currency);
      result[monthIdx].grossILS += grossILS;
      result[monthIdx].taxILS += taxILS;
      result[monthIdx].netILS += grossILS - taxILS;
      result[monthIdx].count++;
      result[monthIdx].holdings.add(d.holding_id);
    }
    return result;
  }, [dividends, selectedYear]);

  // Previous year same period for comparison
  const prevYearMonthly = useMemo(() => {
    const result = Array(12).fill(0).map(() => ({ netILS: 0 }));
    const prevYear = selectedYear - 1;
    for (const d of dividends) {
      if (!d.payment_date) continue;
      const date = new Date(d.payment_date);
      if (date.getFullYear() !== prevYear) continue;
      const grossILS = d.amount * getRate(d.currency);
      const taxILS = (d.tax_withheld || 0) * getRate(d.currency);
      result[date.getMonth()].netILS += grossILS - taxILS;
    }
    return result;
  }, [dividends, selectedYear]);

  // Last dividend info per holding (for ex-date and payment date display)
  const lastDividendPerHolding = useMemo(() => {
    const map = new Map<string, DividendWithHolding>();
    for (const d of dividends) {
      if (!d.payment_date) continue;
      const existing = map.get(d.holding_id);
      if (!existing || (d.payment_date > (existing.payment_date || ""))) {
        map.set(d.holding_id, d);
      }
    }
    return map;
  }, [dividends]);

  const getCurrSym = (c: string) => ({ ILS: "₪", USD: "$", EUR: "€", CAD: "C$" }[c] || c);
  const yearTotal = monthlyHistory.reduce((s, m) => s + m.netILS, 0);
  const prevYearTotal = prevYearMonthly.reduce((s, m) => s + m.netILS, 0);
  const yoyChange = prevYearTotal > 0 ? ((yearTotal - prevYearTotal) / prevYearTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Monthly history by year */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>היסטוריית דיבידנדים חודשית</CardTitle>
            <CardDescription>
              נטו אחרי מס — רק דיבידנדים שהיית זכאי להם
              {prevYearTotal > 0 && (
                <span className={`mr-2 font-semibold ${yoyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ({yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}% מול {selectedYear - 1})
                </span>
              )}
            </CardDescription>
          </div>
          {years.length > 0 && (
            <div className="flex items-center gap-1">
              {years.map(y => (
                <Button key={y} variant={y === selectedYear ? "default" : "ghost"} size="sm" onClick={() => setSelectedYear(y)}>
                  {y}
                </Button>
              ))}
            </div>
          )}
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
                <TableHead className="text-right">מול {selectedYear - 1}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyHistory.map((m, i) => {
                const prevNet = prevYearMonthly[i].netILS;
                const diff = prevNet > 0 ? ((m.netILS - prevNet) / prevNet) * 100 : null;
                return (
                  <TableRow key={i} className={m.count === 0 ? 'opacity-40' : ''}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell>{m.count > 0 ? m.count : '—'}</TableCell>
                    <TableCell dir="ltr" className="text-green-500 font-semibold">
                      {m.grossILS > 0 ? `₪${m.grossILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {m.taxILS > 0 ? `₪${m.taxILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                    </TableCell>
                    <TableCell dir="ltr" className="font-bold">
                      {m.netILS > 0 ? `₪${m.netILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                    </TableCell>
                    <TableCell dir="ltr">
                      {diff !== null && m.netILS > 0 ? (
                        <span className={diff >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(0)}%
                        </span>
                      ) : prevNet > 0 && m.netILS === 0 ? (
                        <span className="text-red-500">-100%</span>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="border-t-2 font-bold">
                <TableCell>סה״כ {selectedYear}</TableCell>
                <TableCell>{monthlyHistory.reduce((s, m) => s + m.count, 0)}</TableCell>
                <TableCell dir="ltr" className="text-green-500">₪{monthlyHistory.reduce((s, m) => s + m.grossILS, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                <TableCell dir="ltr" className="text-muted-foreground">₪{monthlyHistory.reduce((s, m) => s + m.taxILS, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                <TableCell dir="ltr">₪{yearTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                <TableCell dir="ltr">
                  {prevYearTotal > 0 && (
                    <span className={yoyChange >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                    </span>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Last dividend per holding with ex-date and payment date */}
      <Card>
        <CardHeader>
          <CardTitle>דיבידנד אחרון לפי נייר ערך</CardTitle>
          <CardDescription>תאריך זכאות, תאריך תשלום וסכום אחרון — נתוני אמת בלבד</CardDescription>
        </CardHeader>
        <CardContent>
          {lastDividendPerHolding.size === 0 ? (
            <p className="text-center text-muted-foreground py-4">אין דיבידנדים</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">נייר ערך</TableHead>
                  <TableHead className="text-right">תאריך זכאות</TableHead>
                  <TableHead className="text-right">תאריך תשלום</TableHead>
                  <TableHead className="text-right">סכום ברוטו</TableHead>
                  <TableHead className="text-right">מס</TableHead>
                  <TableHead className="text-right">נטו</TableHead>
                  <TableHead className="text-right">מניות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(lastDividendPerHolding.values())
                  .sort((a, b) => (b.payment_date || "").localeCompare(a.payment_date || ""))
                  .map((d) => {
                    const curr = getCurrSym(d.currency || "ILS");
                    const net = d.amount - (d.tax_withheld || 0);
                    return (
                      <TableRow key={d.holding_id}>
                        <TableCell>
                          <Link to={`/holding/${d.holding_id}`} className="hover:underline font-medium">
                            {d.holdings?.symbol || "?"} <span className="text-xs text-muted-foreground">({d.holdings?.name})</span>
                          </Link>
                        </TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground">
                          {d.ex_date ? new Date(d.ex_date).toLocaleDateString("he-IL") : "—"}
                        </TableCell>
                        <TableCell dir="ltr">
                          {d.payment_date ? new Date(d.payment_date).toLocaleDateString("he-IL") : "—"}
                        </TableCell>
                        <TableCell dir="ltr" className="text-green-500">{curr}{d.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground">{curr}{(d.tax_withheld || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell dir="ltr" className="font-semibold">{curr}{net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell dir="ltr">{d.shares_at_payment?.toLocaleString() || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
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
