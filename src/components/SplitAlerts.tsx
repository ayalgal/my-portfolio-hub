import { useSplits, StockSplit } from "@/hooks/useSplits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SplitSquareVertical, Check, X, Loader2 } from "lucide-react";

export function SplitAlerts() {
  const { pendingSplits, isLoading, applySplit, dismissSplit } = useSplits();

  if (isLoading || pendingSplits.length === 0) return null;

  const formatRatio = (split: StockSplit) => {
    return `${split.ratio_from}:${split.ratio_to}`;
  };

  const getSplitDescription = (split: StockSplit) => {
    const ratio = split.ratio_to / split.ratio_from;
    if (ratio > 1) {
      return `ספליט ${formatRatio(split)} — כל מניה תהפוך ל-${ratio} מניות, המחיר יחולק ב-${ratio}`;
    } else {
      const reverseRatio = split.ratio_from / split.ratio_to;
      return `איחוד מניות ${formatRatio(split)} — כל ${reverseRatio} מניות יהפכו למניה אחת, המחיר יוכפל ב-${reverseRatio}`;
    }
  };

  return (
    <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <SplitSquareVertical className="h-5 w-5" />
          ספליטים שזוהו ({pendingSplits.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingSplits.map((split) => (
          <Alert key={split.id} className="bg-background">
            <AlertTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold" dir="ltr">{split.symbol}</span>
                <Badge variant="outline">{formatRatio(split)}</Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(split.split_date).toLocaleDateString('he-IL')}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => applySplit.mutate(split.id)}
                  disabled={applySplit.isPending}
                >
                  {applySplit.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 ml-1" />
                      החל
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismissSplit.mutate(split.id)}
                  disabled={dismissSplit.isPending}
                >
                  <X className="h-4 w-4 ml-1" />
                  התעלם
                </Button>
              </div>
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm">
              {getSplitDescription(split)}
            </AlertDescription>
          </Alert>
        ))}
        <p className="text-xs text-muted-foreground">
          הספליטים זוהו אוטומטית לפי נתוני השוק. אם ביצעת קנייה/מכירה באותו תאריך, ודא שהכמויות מעודכנות לפני החלת הספליט.
        </p>
      </CardContent>
    </Card>
  );
}
