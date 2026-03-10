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

  const originalAmount = holding.average_cost;
  const currentInterest = (holding.current_price || holding.average_cost) - holding.average_cost;
  const currSym = holding.currency === "USD" ? "$" : holding.currency === "CAD" ? "C$" : "₪";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newOriginal = parseFloat(formData.get("originalAmount") as string) || originalAmount;
    const newInterest = parseFloat(formData.get("interestAmount") as string) || 0;

    updateHolding.mutate({
      id: holding.id,
      average_cost: newOriginal,
      current_price: newOriginal + newInterest,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        toast({
          title: "חיסכון עודכן",
          description: `סכום מקורי: ${currSym}${newOriginal.toLocaleString()} · ריבית: ${currSym}${newInterest.toLocaleString()}`,
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>עדכון חיסכון — {holding.name}</DialogTitle>
          <DialogDescription>עדכן את הסכום והריבית שנצברה</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="originalAmount">סכום מקורי</Label>
            <Input id="originalAmount" name="originalAmount" type="number" step="0.01" defaultValue={originalAmount} required dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interestAmount">סכום ריבית שנצבר</Label>
            <Input id="interestAmount" name="interestAmount" type="number" step="0.01" defaultValue={currentInterest > 0 ? currentInterest : 0} dir="ltr" />
          </div>
          <Button type="submit" className="w-full" disabled={updateHolding.isPending}>
            {updateHolding.isPending ? "מעדכן..." : "עדכן"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
