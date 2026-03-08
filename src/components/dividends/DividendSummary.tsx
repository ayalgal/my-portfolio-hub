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
  const holdingSummary = useMemo(() => {
    const map = new Map<string, {
      holdingId: string;
      symbol: string;
      name: string;
      totalGross: number;
      totalTax: number;
      count: number;
      lastAmount: number | null;
      lastDate: string | null;
    }>();

    for (const d of dividends) {
      const key = d.holding_id;
      const prev = map.get(key);
      const grossILS = d.amount * getRate(d.currency);
      const taxILS = (d.tax_withheld || 0) * getRate(d.currency);

      if (prev) {
        prev.totalGross += grossILS;
        prev.totalTax += taxILS;
        prev.count++;
        if (!prev.lastDate || (d.payment_date && d.payment_date > prev.lastDate)) {
          prev.lastDate = d.payment_date;
          prev.lastAmount = d.amount;
        }
      } else {
        map.set(key, {
          holdingId: d.holding_id,
          symbol: d.holdings?.symbol || "?",
          name: d.holdings?.name || "",
          totalGross: grossILS,
          totalTax: taxILS,
          count: 1,
          lastAmount: d.amount,
          lastDate: d.payment_date,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalGross - a.totalGross);
  }, [dividends]);

  const categorySummary = useMemo(() => {
    // Map holding -> categories
    const holdingToCats = new Map<string, { name: string; color: string | null; id: string }[]>();
    for (const hc of holdingCategories) {
      if (!hc.allocation_categories) continue;
      const prev = holdingToCats.get(hc.holding_id) || [];
      prev.push({ name: hc.allocation_categories.name, color: hc.allocation_categories.color, id: hc.category_id });
      holdingToCats.set(hc.holding_id, prev);
    }

    const catMap = new Map<string, {
      name: string;
      color: string | null;
      totalGross: number;
      totalTax: number;
      count: number;
      holdings: Set<string>;
    }>();

    for (const d of dividends) {
      const cats = holdingToCats.get(d.holding_id) || [{ name: "ללא תיקייה", color: null, id: "uncategorized" }];
      const grossILS = d.amount * getRate(d.currency);
      const taxILS = (d.tax_withheld || 0) * getRate(d.currency);

      for (const cat of cats) {
        const prev = catMap.get(cat.id);
        if (prev) {
          prev.totalGross += grossILS;
          prev.totalTax += taxILS;
          prev.count++;
          prev.holdings.add(d.holding_id);
        } else {
          catMap.set(cat.id, {
            name: cat.name,
            color: cat.color,
            totalGross: grossILS,
            totalTax: taxILS,
            count: 1,
            holdings: new Set([d.holding_id]),
          });
        }
      }
    }

    return Array.from(catMap.values()).sort((a, b) => b.totalGross - a.totalGross);
  }, [dividends, holdingCategories]);

  // Estimated upcoming dividends based on last dividend per holding annualized to quarterly
  const upcomingEstimates = useMemo(() => {
    const estimates: { holdingId: string; symbol: string; name: string; estimatedAmount: number; estimatedAmountILS: number; currency: string; shares: number; lastPerShare: number }[] = [];
    
    // Group dividends by holding, get last one
    const lastDivByHolding = new Map<string, DividendWithHolding>();
    for (const d of dividends) {
      const existing = lastDivByHolding.get(d.holding_id);
      if (!existing || (d.payment_date && (!existing.payment_date || d.payment_date > existing.payment_date))) {
        lastDivByHolding.set(d.holding_id, d);
      }
    }

    for (const [, lastDiv] of lastDivByHolding) {
      if (!lastDiv.holdings || !lastDiv.shares_at_payment || lastDiv.shares_at_payment <= 0) continue;
      const perShare = lastDiv.amount / lastDiv.shares_at_payment;
      const currentShares = lastDiv.holdings.quantity;
      if (currentShares <= 0) continue;
      
      const estimatedAmount = perShare * currentShares;
      estimates.push({
        holdingId: lastDiv.holding_id,
        symbol: lastDiv.holdings.symbol,
        name: lastDiv.holdings.name,
        estimatedAmount,
        estimatedAmountILS: estimatedAmount * getRate(lastDiv.currency),
        currency: lastDiv.currency || "USD",
        shares: currentShares,
        lastPerShare: perShare,
      });
    }

    return estimates.sort((a, b) => b.estimatedAmountILS - a.estimatedAmountILS);
  }, [dividends]);

  const totalEstimatedILS = upcomingEstimates.reduce((s, e) => s + e.estimatedAmountILS, 0);

  const getCurrSym = (c: string) => ({ ILS: "₪", USD: "$", EUR: "€", CAD: "C$" }[c] || c);

  return (
    <div className="space-y-6">
      {/* Upcoming estimates */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            צפי דיבידנדים — תשלום הבא
          </CardTitle>
          <CardDescription>
            אומדן לפי הדיבידנד האחרון × כמות מניות נוכחית
            <span className="font-semibold text-foreground mr-2">
              סה״כ צפי: ₪{totalEstimatedILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingEstimates.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">אין מספיק נתונים לחיזוי</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">נייר ערך</TableHead>
                  <TableHead className="text-right">מניות</TableHead>
                  <TableHead className="text-right">דיבידנד/מניה</TableHead>
                  <TableHead className="text-right">צפי סכום</TableHead>
                  <TableHead className="text-right">צפי ₪</TableHead>
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
                    <TableCell dir="ltr">{e.shares.toLocaleString()}</TableCell>
                    <TableCell dir="ltr">{getCurrSym(e.currency)}{e.lastPerShare.toFixed(4)}</TableCell>
                    <TableCell dir="ltr" className="font-semibold text-green-500">{getCurrSym(e.currency)}{e.estimatedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">₪{e.estimatedAmountILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
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
          <TabsTrigger value="byHolding">לפי נייר ערך</TabsTrigger>
          <TabsTrigger value="byCategory">לפי תיקייה</TabsTrigger>
        </TabsList>

        <TabsContent value="byHolding">
          <Card>
            <CardHeader>
              <CardTitle>סיכום דיבידנדים לפי נייר ערך</CardTitle>
            </CardHeader>
            <CardContent>
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
            <CardHeader>
              <CardTitle>סיכום דיבידנדים לפי תיקייה</CardTitle>
            </CardHeader>
            <CardContent>
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
