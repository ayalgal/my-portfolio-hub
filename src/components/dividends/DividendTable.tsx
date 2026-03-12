import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import type { GroupBy } from "./DividendFilters";
import { getDividendChangeInfo, buildDividendPreviousMap } from "./DividendChangeArrow";

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

type SortField = "date" | "symbol" | "amount" | "shares" | "tax";

interface DividendTableProps {
  dividends: DividendWithHolding[];
  groupBy: GroupBy;
}

export function DividendTable({ dividends, groupBy }: DividendTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterText, setFilterText] = useState("");

  const years = useMemo(() => {
    const yrs = new Set<number>();
    dividends.forEach(d => { if (d.payment_date) yrs.add(new Date(d.payment_date).getFullYear()); });
    return Array.from(yrs).sort((a, b) => b - a);
  }, [dividends]);

  const [selectedYear, setSelectedYear] = useState<number | "all">(() => years[0] || new Date().getFullYear());

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filtered = useMemo(() => {
    let result = dividends;
    if (selectedYear !== "all") {
      result = result.filter(d => d.payment_date && new Date(d.payment_date).getFullYear() === selectedYear);
    }
    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(d =>
        (d.holdings?.symbol || "").toLowerCase().includes(q) ||
        (d.holdings?.name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [dividends, selectedYear, filterText]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = (a.payment_date || "").localeCompare(b.payment_date || ""); break;
        case "symbol": cmp = (a.holdings?.symbol || "").localeCompare(b.holdings?.symbol || ""); break;
        case "amount": cmp = a.amount - b.amount; break;
        case "shares": cmp = (a.shares_at_payment || 0) - (b.shares_at_payment || 0); break;
        case "tax": cmp = (a.tax_withheld || 0) - (b.tax_withheld || 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const prevMap = useMemo(() => buildDividendPreviousMap(sorted), [sorted]);

  if (dividends.length === 0) {
    return <p className="text-center text-muted-foreground py-8">אין דיבידנדים עדיין</p>;
  }

  const controls = (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <div className="flex items-center gap-1 flex-wrap">
        <Button variant={selectedYear === "all" ? "default" : "ghost"} size="sm" onClick={() => setSelectedYear("all")}>הכל</Button>
        {years.map(y => (
          <Button key={y} variant={y === selectedYear ? "default" : "ghost"} size="sm" onClick={() => setSelectedYear(y)}>
            {y}
          </Button>
        ))}
      </div>
      <div className="relative w-40 mr-auto">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="pr-9 h-8 text-sm"
        />
      </div>
    </div>
  );

  const tableHeaders = (
    <TableHeader>
      <TableRow>
        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("date")}>
          <span className="flex items-center gap-1">תאריך <SortIcon field="date" /></span>
        </TableHead>
        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("symbol")}>
          <span className="flex items-center gap-1">נייר ערך <SortIcon field="symbol" /></span>
        </TableHead>
        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>
          <span className="flex items-center gap-1">סכום <SortIcon field="amount" /></span>
        </TableHead>
        <TableHead className="text-right w-10">שינוי</TableHead>
        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("shares")}>
          <span className="flex items-center gap-1">מניות <SortIcon field="shares" /></span>
        </TableHead>
        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("tax")}>
          <span className="flex items-center gap-1">מס <SortIcon field="tax" /></span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );

  if (groupBy !== "all") {
    const groups = groupDividends(sorted, groupBy);
    return (
      <TooltipProvider>
        {controls}
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
                {tableHeaders}
                <TableBody>
                  {g.dividends.map((d) => <DividendRow key={d.id} d={d} prevMap={prevMap} />)}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      {controls}
      <Table>
        {tableHeaders}
        <TableBody>
          {sorted.map((d) => <DividendRow key={d.id} d={d} prevMap={prevMap} />)}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

function DividendRow({ d, prevMap }: { d: DividendWithHolding; prevMap: Map<string, Map<string, number>> }) {
  const cs = getCurrencySymbol(d.currency || "ILS");
  const holdingPrevMap = prevMap.get(d.holding_id);
  const prevAmount = holdingPrevMap?.get(d.payment_date || "") ?? null;
  const changeInfo = getDividendChangeInfo(d.amount, prevAmount);

  return (
    <TableRow>
      <TableCell dir="ltr">{d.payment_date ? new Date(d.payment_date).toLocaleDateString("he-IL") : "-"}</TableCell>
      <TableCell>
        <Link to={`/holding/${d.holding_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
          <span className="font-medium" dir="ltr">{d.holdings?.symbol || "-"}</span>
          {d.holdings?.name && <span className="text-xs text-muted-foreground mr-1">({d.holdings.name})</span>}
        </Link>
      </TableCell>
      <TableCell dir="ltr" className="font-semibold text-green-500">{cs}{d.amount.toLocaleString()}</TableCell>
      <TableCell className="text-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default">{changeInfo.icon}</span>
          </TooltipTrigger>
          <TooltipContent side="top" dir="rtl">
            {changeInfo.changePercent !== null
              ? `${changeInfo.changePercent > 0 ? '+' : ''}${changeInfo.changePercent.toFixed(1)}% מהדיבידנד הקודם`
              : "אין דיבידנד קודם להשוואה"}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell dir="ltr">{d.shares_at_payment || "-"}</TableCell>
      <TableCell dir="ltr" className="text-muted-foreground">{cs}{(d.tax_withheld || 0).toFixed(2)}</TableCell>
    </TableRow>
  );
}
