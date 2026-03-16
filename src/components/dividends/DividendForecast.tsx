import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface DividendInfo {
  holdingId: string;
  symbol: string;
  name: string;
  currency: string;
  quantity: number;
  averageCost: number;
  currentPrice: number | null;
  exDividendDate: string | null;
  dividendDate: string | null;
  dividendRate: number | null;
  dividendYield: number | null;
  lastDividendValue: number | null;
}

const getCurrSym = (c: string) => ({ ILS: "₪", USD: "$", EUR: "€", CAD: "C$" }[c] || c);

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

function isUpcoming(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) >= new Date(new Date().toISOString().split("T")[0]);
}

export function DividendForecast() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["dividend-forecast", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("dividend-forecast");
      if (error) throw error;
      return data as { forecasts: DividendInfo[] };
    },
    staleTime: 1000 * 60 * 10, // 10 min
  });

  const forecasts = data?.forecasts ?? [];
  const upcoming = forecasts.filter(f => isUpcoming(f.exDividendDate) || isUpcoming(f.dividendDate));
  const withDividends = forecasts.filter(f => f.dividendRate && f.dividendRate > 0);
  const noDividends = forecasts.filter(f => !f.dividendRate || f.dividendRate === 0);

  const totalAnnualEstimate = withDividends.reduce(
    (sum, f) => sum + (f.dividendRate || 0) * f.quantity,
    0
  );

  if (isLoading) {
    return <Skeleton className="h-60 w-full" />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40 text-destructive" />
          <p>שגיאה בטעינת נתוני צפי</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setRefreshKey(k => k + 1)}>
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (forecasts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>אין החזקות פעילות להצגת צפי דיבידנד</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upcoming ex-dates */}
      {upcoming.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              תאריכים קרובים
            </CardTitle>
            <CardDescription>תאריכי Ex-Date ותשלום קרובים על פי הכרזות בפועל</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">נייר ערך</TableHead>
                  <TableHead className="text-right">Ex-Date</TableHead>
                  <TableHead className="text-right">תאריך תשלום</TableHead>
                  <TableHead className="text-right">מניות</TableHead>
                  <TableHead className="text-right">דיבידנד שנתי/מניה</TableHead>
                  <TableHead className="text-right">צפי שנתי</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((f) => {
                  const curr = getCurrSym(f.currency);
                  const annualTotal = (f.dividendRate || 0) * f.quantity;
                  return (
                    <TableRow key={f.holdingId}>
                      <TableCell>
                        <Link to={`/holding/${f.holdingId}`} className="hover:underline font-medium">
                          {f.symbol} <span className="text-xs text-muted-foreground">({f.name})</span>
                        </Link>
                      </TableCell>
                      <TableCell dir="ltr">
                        {isUpcoming(f.exDividendDate) ? (
                          <Badge variant="default" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                            {formatDate(f.exDividendDate)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{formatDate(f.exDividendDate)}</span>
                        )}
                      </TableCell>
                      <TableCell dir="ltr">
                        {isUpcoming(f.dividendDate) ? (
                          <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/30">
                            {formatDate(f.dividendDate)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{formatDate(f.dividendDate)}</span>
                        )}
                      </TableCell>
                      <TableCell dir="ltr">{f.quantity.toLocaleString()}</TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">
                        {f.dividendRate ? `${curr}${f.dividendRate.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell dir="ltr" className="font-semibold text-amber-600 dark:text-amber-400">
                        {annualTotal > 0 ? `${curr}${annualTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All dividend-paying holdings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">כל ההחזקות המחלקות דיבידנד</CardTitle>
              <CardDescription>
                נתונים מבוססים על הכרזות בפועל.
                סה״כ שנתי משוער: <span className="font-semibold text-foreground">
                  ${totalAnnualEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {withDividends.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">נייר ערך</TableHead>
                  <TableHead className="text-right">Ex-Date אחרון</TableHead>
                  <TableHead className="text-right">תשלום הבא</TableHead>
                  <TableHead className="text-right">מניות</TableHead>
                  <TableHead className="text-right">דיבידנד שנתי/מניה</TableHead>
                  <TableHead className="text-right">תשואת דיבידנד</TableHead>
                  <TableHead className="text-right">צפי שנתי</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withDividends.map((f) => {
                  const curr = getCurrSym(f.currency);
                  const annualTotal = (f.dividendRate || 0) * f.quantity;
                  return (
                    <TableRow key={f.holdingId}>
                      <TableCell>
                        <Link to={`/holding/${f.holdingId}`} className="hover:underline font-medium">
                          {f.symbol} <span className="text-xs text-muted-foreground">({f.name})</span>
                        </Link>
                      </TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground text-sm">
                        {formatDate(f.exDividendDate)}
                      </TableCell>
                      <TableCell dir="ltr" className="text-sm">
                        {isUpcoming(f.dividendDate) ? (
                          <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/30 text-xs">
                            {formatDate(f.dividendDate)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{formatDate(f.dividendDate)}</span>
                        )}
                      </TableCell>
                      <TableCell dir="ltr">{f.quantity.toLocaleString()}</TableCell>
                      <TableCell dir="ltr">
                        {f.dividendRate ? `${curr}${f.dividendRate.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell dir="ltr">
                        {f.dividendYield !== null ? (
                          <span className={f.dividendYield >= 3 ? "text-green-500 font-semibold" : ""}>
                            {f.dividendYield.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell dir="ltr" className="font-semibold text-amber-600 dark:text-amber-400">
                        {curr}{annualTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-6">אין החזקות שמחלקות דיבידנד</p>
          )}
        </CardContent>
      </Card>

      {noDividends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">החזקות ללא דיבידנד</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {noDividends.map(f => (
                <Badge key={f.holdingId} variant="secondary" className="text-xs">
                  <Link to={`/holding/${f.holdingId}`} className="hover:underline">{f.symbol}</Link>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ הנתונים מבוססים על הכרזות דיבידנד בפועל ממקורות חיצוניים ואינם מהווים המלצה.
      </p>
    </div>
  );
}
