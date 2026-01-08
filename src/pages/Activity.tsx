import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, RefreshCw, TrendingUp, DollarSign } from "lucide-react";

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'dividend' | 'split' | 'reverse_split';
  holdingName: string;
  holdingSymbol: string;
  quantity: number;
  price: number;
  totalAmount: number;
  currency: string;
  date: string;
  notes?: string;
  splitRatio?: string;
}

const transactions: Transaction[] = [
  {
    id: "1",
    type: "buy",
    holdingName: "Apple Inc.",
    holdingSymbol: "AAPL",
    quantity: 10,
    price: 175.50,
    totalAmount: 1755,
    currency: "USD",
    date: "2024-01-15",
  },
  {
    id: "2",
    type: "dividend",
    holdingName: "בנק הפועלים",
    holdingSymbol: "POLI",
    quantity: 500,
    price: 0.30,
    totalAmount: 150,
    currency: "ILS",
    date: "2024-01-10",
  },
  {
    id: "3",
    type: "sell",
    holdingName: "Microsoft",
    holdingSymbol: "MSFT",
    quantity: 5,
    price: 380,
    totalAmount: 1900,
    currency: "USD",
    date: "2024-01-05",
  },
  {
    id: "4",
    type: "reverse_split",
    holdingName: "NVIDIA",
    holdingSymbol: "NVDA",
    quantity: 40,
    price: 0,
    totalAmount: 0,
    currency: "USD",
    date: "2024-01-02",
    splitRatio: "1:10",
    notes: "ריברס ספליט - 40 מניות הפכו ל-4",
  },
];

const getTypeConfig = (type: Transaction['type']) => {
  const configs = {
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
  return configs[type];
};

const getCurrencySymbol = (currency: string) => {
  const symbols: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };
  return symbols[currency] || currency;
};

export default function Activity() {
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
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const config = getTypeConfig(transaction.type);
                const Icon = config.icon;
                const currencySymbol = getCurrencySymbol(transaction.currency);
                
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
                        <span className="font-medium">{transaction.holdingSymbol}</span>
                        <Badge variant="outline" className={config.color}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {transaction.holdingName}
                        {transaction.notes && ` • ${transaction.notes}`}
                      </p>
                    </div>
                    
                    <div className="text-left">
                      {transaction.type !== 'split' && transaction.type !== 'reverse_split' ? (
                        <>
                          <div className={`font-semibold ${
                            transaction.type === 'sell' ? 'text-red-500' : 
                            transaction.type === 'buy' ? 'text-green-500' : 
                            'text-blue-500'
                          }`}>
                            {transaction.type === 'sell' ? '+' : transaction.type === 'buy' ? '-' : '+'}
                            {currencySymbol}{transaction.totalAmount.toLocaleString()}
                          </div>
                          <p className="text-xs text-muted-foreground" dir="ltr">
                            {transaction.quantity} × {currencySymbol}{transaction.price}
                          </p>
                        </>
                      ) : (
                        <div className="font-medium text-orange-500">
                          {transaction.splitRatio}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-left text-sm text-muted-foreground min-w-[80px]">
                      {new Date(transaction.date).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
