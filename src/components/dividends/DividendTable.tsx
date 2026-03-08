import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { GroupBy } from "./DividendFilters";

interface DividendWithHolding {
  id: string;
  payment_date: string | null;
  amount: number;
  currency: string | null;
  shares_at_payment: number | null;
  tax_withheld: number | null;
  is_israeli: boolean | null;
  holding_id: string;
  holdings: { name: string; symbol: string } | null;
}

interface GroupedData {
  label: string;
  dividends: DividendWithHolding[];
  totalAmount: number;
  totalTax: number;
  count: number;
}

const getCurrencySymbol = (currency: string) => {
  const symbols: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€", CAD: "C$" };
  return symbols[currency || "ILS"] || currency;
};

const getExchangeRate = (currency: string | null) => {
  if (currency === "USD") return 3.7;
  if (currency === "EUR") return 4.0;
  if (currency === "CAD") return 2.7;
  return 1;
};

function groupDividends(dividends: DividendWithHolding[], groupBy: GroupBy): GroupedData[] {
  if (groupBy === "all") return [];

  const groups = new Map<string, DividendWithHolding[]>();

  for (const d of dividends) {
    let key: string;
    if (groupBy === "holding") {
      key = d.holdings?.symbol || d.holding_id;
    } else {
      const date = d.payment_date ? new Date(d.payment_date) : null;
      if (!date) { key = "ללא תאריך"; }
      else if (groupBy === "month") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (groupBy === "quarter") {
        const q = Math.ceil((date.getMonth() + 1) / 3);
        key = `${date.getFullYear()} Q${q}`;
      } else {
        key = `${date.getFullYear()}`;
      }
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  const result: GroupedData[] = [];
  for (const [label, items] of groups) {
    const totalAmount = items.reduce((s, d) => s + d.amount * getExchangeRate(d.currency), 0);
    const totalTax = items.reduce((s, d) => s + (d.tax_withheld || 0) * getExchangeRate(d.currency), 0);
    result.push({ label, dividends: items, totalAmount, totalTax, count: items.length });
  }

  return result.sort((a, b) => b.label.localeCompare(a.label));
}

interface DividendTableProps {
  dividends: DividendWithHolding[];
  groupBy: GroupBy;
}

export function DividendTable({ dividends, groupBy }: DividendTableProps) {
  if (dividends.length === 0) {
    return <p className="text-center text-muted-foreground py-8">אין דיבידנדים עדיין</p>;
  }

  if (groupBy !== "all") {
    const groups = groupDividends(dividends, groupBy);
    return (
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.label} className="rounded-lg border">
            <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5 rounded-t-lg">
              <span className="font-semibold">{g.label}</span>
              <div className="flex gap-4 text-sm">
                <span className="text-green-500 font-medium">₪{g.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-muted-foreground">מס: ₪{g.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <Badge variant="outline">{g.count} תשלומים</Badge>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">נייר ערך</TableHead>
                  <TableHead className="text-right">סכום</TableHead>
                  <TableHead className="text-right">מניות</TableHead>
                  <TableHead className="text-right">מס</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.dividends.map((d) => <DividendRow key={d.id} d={d} />)}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">תאריך</TableHead>
          <TableHead className="text-right">נייר ערך</TableHead>
          <TableHead className="text-right">סכום</TableHead>
          <TableHead className="text-right">מניות</TableHead>
          <TableHead className="text-right">מס</TableHead>
          <TableHead className="text-right">סוג</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dividends.map((d) => <DividendRow key={d.id} d={d} />)}
      </TableBody>
    </Table>
  );
}

function DividendRow({ d }: { d: DividendWithHolding }) {
  const cs = getCurrencySymbol(d.currency || "ILS");
  return (
    <TableRow>
      <TableCell dir="ltr">{d.payment_date ? new Date(d.payment_date).toLocaleDateString("he-IL") : "-"}</TableCell>
      <TableCell>
        <span className="font-medium" dir="ltr">{d.holdings?.symbol || "-"}</span>
        {d.holdings?.name && <span className="text-xs text-muted-foreground mr-1">({d.holdings.name})</span>}
      </TableCell>
      <TableCell dir="ltr" className="font-semibold text-green-500">{cs}{d.amount.toLocaleString()}</TableCell>
      <TableCell dir="ltr">{d.shares_at_payment || "-"}</TableCell>
      <TableCell dir="ltr" className="text-muted-foreground">{cs}{(d.tax_withheld || 0).toFixed(2)}</TableCell>
      <TableCell>
        <Badge variant={d.is_israeli ? "default" : "secondary"}>
          {d.is_israeli ? "ישראלי" : "בינלאומי"}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
