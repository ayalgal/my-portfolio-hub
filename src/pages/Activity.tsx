import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, RefreshCw, DollarSign, Clock } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { Skeleton } from "@/components/ui/skeleton";

const getTypeConfig = (type: string) => {
  const configs: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    buy: {
      label: "קנייה",
      icon: ArrowDownRight,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    sell: {
      label: "מכירה",
      icon: ArrowUpRight,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    dividend: {
      label: "דיבידנד",
      icon: DollarSign,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    split: {
      label: "ספליט",
      icon: RefreshCw,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    reverse_split: {
      label: "ריברס ספליט",
      icon: RefreshCw,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  };
  return configs[type] || configs.buy;
};

const getCurrencySymbol = (currency: string | null) => {
  const symbols: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };
  return symbols[currency || "ILS"] || currency || "₪";
};

export default function Activity() {
  const { transactions, isLoading } = useTransactions();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">פעילות</h1>
          <p className="text-muted-foreground">היסטוריית עסקאות ופעולות בפורטפוליו</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>היסטוריית פעילות</CardTitle>
            <CardDescription>כל העסקאות והפעולות שבוצעו</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">אין פעילות עדיין</h3>
                <p className="text-muted-foreground text-center">
                  עסקאות יוצגו כאן לאחר רישום
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction: any) => {
                  const config = getTypeConfig(transaction.transaction_type);
                  const Icon = config.icon;
                  const currencySymbol = getCurrencySymbol(transaction.currency);
                  const splitRatio = transaction.split_ratio_from && transaction.split_ratio_to 
                    ? `${transaction.split_ratio_from}:${transaction.split_ratio_to}`
                    : null;
                  
                  return (
                    <div 
                      key={transaction.id}
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {transaction.holdings?.symbol || "—"}
                          </span>
                          <Badge variant="outline" className={config.color}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {transaction.holdings?.name || "—"}
                          {transaction.notes && ` • ${transaction.notes}`}
                        </p>
                      </div>
                      
                      <div className="text-left">
                        {transaction.transaction_type !== 'split' && transaction.transaction_type !== 'reverse_split' ? (
                          <>
                            <div className={`font-semibold ${
                              transaction.transaction_type === 'sell' ? 'text-red-500' : 
                              transaction.transaction_type === 'buy' ? 'text-green-500' : 
                              'text-blue-500'
                            }`}>
                              {transaction.transaction_type === 'sell' ? '+' : transaction.transaction_type === 'buy' ? '-' : '+'}
                              {currencySymbol}{transaction.total_amount?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {transaction.quantity} × {currencySymbol}{transaction.price}
                            </p>
                          </>
                        ) : (
                          <div className="font-medium text-orange-500">
                            {splitRatio}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-left text-sm text-muted-foreground min-w-[80px]">
                        {new Date(transaction.transaction_date).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
