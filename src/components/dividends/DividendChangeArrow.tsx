import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react";

/**
 * Given a list of dividends sorted desc by date for the same holding,
 * compute % change from previous dividend and return colored arrow.
 */
export function getDividendChangeInfo(
  currentAmount: number,
  previousAmount: number | null
): { icon: React.ReactNode; changePercent: number | null; color: string } {
  if (previousAmount === null || previousAmount === 0) {
    return { icon: <Minus className="h-3.5 w-3.5 text-muted-foreground" />, changePercent: null, color: "text-muted-foreground" };
  }

  const changePercent = ((currentAmount - previousAmount) / previousAmount) * 100;
  const color = getChangeColor(changePercent);

  if (Math.abs(changePercent) < 1) {
    return { icon: <Minus className="h-3.5 w-3.5" style={{ color }} />, changePercent, color };
  }

  if (changePercent > 0) {
    const Icon = changePercent > 20 ? TrendingUp : ArrowUp;
    return { icon: <Icon className="h-3.5 w-3.5" style={{ color }} />, changePercent, color };
  }

  const Icon = changePercent < -20 ? TrendingDown : ArrowDown;
  return { icon: <Icon className="h-3.5 w-3.5" style={{ color }} />, changePercent, color };
}

/**
 * Returns a color on a gradient scale:
 * Deep red (-50%+) → orange (-20%) → yellow (0%) → light green (+20%) → deep green (+50%+)
 */
function getChangeColor(changePercent: number): string {
  if (changePercent <= -50) return "#dc2626"; // red-600
  if (changePercent <= -20) return "#ea580c"; // orange-600
  if (changePercent <= -5) return "#f59e0b";  // amber-500
  if (changePercent < 5) return "#a3a3a3";    // neutral-400
  if (changePercent < 20) return "#84cc16";   // lime-500
  if (changePercent < 50) return "#22c55e";   // green-500
  return "#16a34a"; // green-600
}

/**
 * Build a map of holding_id -> previous dividend amount for quick lookup.
 * Dividends should be sorted desc by payment_date.
 */
export function buildDividendPreviousMap(
  dividends: { holding_id: string; amount: number; payment_date: string | null }[]
): Map<string, Map<string, number>> {
  // Group by holding_id, then for each dividend find the next one (previous in time)
  const byHolding = new Map<string, typeof dividends>();
  for (const d of dividends) {
    if (!byHolding.has(d.holding_id)) byHolding.set(d.holding_id, []);
    byHolding.get(d.holding_id)!.push(d);
  }

  // Map: holding_id -> Map<payment_date, previous_amount>
  const result = new Map<string, Map<string, number>>();
  for (const [holdingId, divs] of byHolding) {
    // Already sorted desc
    const dateMap = new Map<string, number>();
    for (let i = 0; i < divs.length - 1; i++) {
      const key = divs[i].payment_date || "";
      dateMap.set(key, divs[i + 1].amount);
    }
    result.set(holdingId, dateMap);
  }

  return result;
}
