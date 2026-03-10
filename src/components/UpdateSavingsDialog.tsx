import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHoldings, Holding } from "@/hooks/useHoldings";
import { useToast } from "@/hooks/use-toast";

interface UpdateSavingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: Holding | null;
}

export function UpdateSavingsDialog({ open, onOpenChange, holding }: UpdateSavingsDialogProps) {
  const { updateHolding } = useHoldings();
  const { toast } = useToast();

  if (!holding) return null;

  const isCash = holding.asset_type === "cash";
  const originalAmount = holding.average_cost;
  const currentTotal = holding.current_price || holding.average_cost;
  const currSym = holding.currency === "USD" ? "$" : holding.currency === "CAD" ? "C$" : holding.currency === "EUR" ? "€" : "₪";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (isCash) {
      const amount = parseFloat(formData.get("amount") as string) || 0;
      updateHolding.mutate({
        id: holding.id,
        average_cost: amount,
        current_price: amount,
      }, {
        onSuccess: () => {
          onOpenChange(false);
          toast({ title: "מזומן עודכן", description: `סכום: ${currSym}${amount.toLocaleString()}` });
        },
      });
    } else {
      const newOriginal = parseFloat(formData.get("originalAmount") as string) || originalAmount;
      const newTotal = parseFloat(formData.get("totalAmount") as string) || newOriginal;

      updateHolding.mutate({
        id: holding.id,
        average_cost: newOriginal,
        current_price: newTotal,
      }, {
        onSuccess: () => {
          onOpenChange(false);
          const interest = newTotal - newOriginal;
          toast({
            title: "חיסכון עודכן",
            description: `סכום מושקע: ${currSym}${newOriginal.toLocaleString()} · שווי נוכחי: ${currSym}${newTotal.toLocaleString()} · ריבית: ${currSym}${interest.toLocaleString()}`,
          });
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isCash ? "עדכון מזומן" : "עדכון חיסכון"} — {holding.name}</DialogTitle>
          <DialogDescription>{isCash ? "עדכן את סכום המזומן" : "עדכן את הסכום המושקע ושווי החיסכון הנוכחי"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isCash ? (
            <div className="space-y-2">
              <Label htmlFor="amount">סכום</Label>
              <Input id="amount" name="amount" type="number" step="0.01" defaultValue={originalAmount} required dir="ltr" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="originalAmount">סכום מושקע</Label>
                <Input id="originalAmount" name="originalAmount" type="number" step="0.01" defaultValue={originalAmount} required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalAmount">שווי חיסכון נוכחי (כולל ריבית)</Label>
                <Input id="totalAmount" name="totalAmount" type="number" step="0.01" defaultValue={currentTotal} required dir="ltr" />
              </div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={updateHolding.isPending}>
            {updateHolding.isPending ? "מעדכן..." : "עדכן"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
