import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHoldings } from "@/hooks/useHoldings";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useToast } from "@/hooks/use-toast";

interface AddHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddHoldingDialog({ open, onOpenChange }: AddHoldingDialogProps) {
  const [selectedAssetType, setSelectedAssetType] = useState("stock");
  const { portfolios } = usePortfolio();
  const defaultPortfolioId = portfolios?.[0]?.id;
  const { createHolding } = useHoldings(defaultPortfolioId);
  const { toast } = useToast();

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { ILS: "₪", USD: "$", CAD: "C$", EUR: "€" };
    return symbols[currency || "ILS"] || currency;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!defaultPortfolioId) return;
    const formData = new FormData(e.currentTarget);
    const isBankSavings = selectedAssetType === "bank_savings";
    const fundNumber = formData.get("fundNumber") as string;
    const name = formData.get("name") as string;
    const currency = formData.get("currency") as string || "ILS";
    const currSym = getCurrencySymbol(currency);

    let quantity: number;
    let averageCost: number;
    let currentPrice: number | undefined;

    if (isBankSavings) {
      const originalAmount = parseFloat(formData.get("originalAmount") as string) || 0;
      const interestAmount = parseFloat(formData.get("interestAmount") as string) || 0;
      quantity = 1;
      averageCost = originalAmount;
      currentPrice = originalAmount + interestAmount;
    } else {
      quantity = parseFloat(formData.get("quantity") as string) || 0;
      averageCost = parseFloat(formData.get("averageCost") as string) || 0;
    }

    createHolding.mutate({
      symbol: fundNumber || (formData.get("symbol") as string),
      name,
      asset_type: selectedAssetType || "stock",
      quantity,
      average_cost: averageCost,
      current_price: currentPrice ?? null,
      currency,
      portfolio_id: defaultPortfolioId,
      fund_number: fundNumber || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        if (isBankSavings) {
          toast({
            title: `${name} נוסף בהצלחה`,
            description: `סכום מקורי: ${currSym}${averageCost.toLocaleString()} · ריבית: ${currSym}${((currentPrice || 0) - averageCost).toLocaleString()}`,
            duration: 8000,
          });
        } else {
          const totalValue = quantity * averageCost;
          toast({
            title: `${name} נוסף בהצלחה`,
            description: `כמות: ${quantity.toLocaleString()} · עלות ממוצעת: ${currSym}${averageCost.toLocaleString()} · שווי: ${currSym}${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            duration: 8000,
          });
        }
      },
    });
  };

  const isBankSavings = selectedAssetType === "bank_savings";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף נייר ערך חדש</DialogTitle>
          <DialogDescription>הזן את פרטי נייר הערך להוספה לפורטפוליו</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assetType">סוג נכס</Label>
              <Select name="assetType" defaultValue="stock" onValueChange={setSelectedAssetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">מניה</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                  <SelectItem value="mutual_fund">קרן נאמנות</SelectItem>
                  <SelectItem value="israeli_fund">קרן כספית ישראלית</SelectItem>
                  <SelectItem value="bank_savings">חיסכון בנקאי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {selectedAssetType === 'israeli_fund' ? (
                <>
                  <Label htmlFor="fundNumber">מספר קרן (7 ספרות)</Label>
                  <Input id="fundNumber" name="fundNumber" placeholder="5131377" required dir="ltr" maxLength={7} />
                </>
              ) : isBankSavings ? (
                <>
                  <Label htmlFor="symbol">מזהה (שם הבנק)</Label>
                  <Input id="symbol" name="symbol" placeholder="לאומי" required />
                </>
              ) : (
                <>
                  <Label htmlFor="symbol">סימול</Label>
                  <Input id="symbol" name="symbol" placeholder="AAPL" required dir="ltr" />
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">שם</Label>
            <Input id="name" name="name" placeholder={isBankSavings ? "חיסכון לאומי 12 חודשים" : "Apple Inc."} required />
          </div>

          {isBankSavings ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="originalAmount">סכום מקורי</Label>
                <Input id="originalAmount" name="originalAmount" type="number" step="0.01" placeholder="50000" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interestAmount">סכום ריבית שנצבר</Label>
                <Input id="interestAmount" name="interestAmount" type="number" step="0.01" placeholder="1500" defaultValue="0" dir="ltr" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">כמות</Label>
                <Input id="quantity" name="quantity" type="number" step="0.0001" placeholder="10" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="averageCost">עלות ממוצעת</Label>
                <Input id="averageCost" name="averageCost" type="number" step="0.01" placeholder="150.00" required dir="ltr" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currency">מטבע</Label>
            <Select name="currency" defaultValue={isBankSavings ? "ILS" : "ILS"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ILS">₪ שקל</SelectItem>
                <SelectItem value="USD">$ דולר</SelectItem>
                <SelectItem value="CAD">C$ דולר קנדי</SelectItem>
                <SelectItem value="EUR">€ אירו</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={createHolding.isPending}>
            {createHolding.isPending ? "מוסיף..." : "הוסף"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
