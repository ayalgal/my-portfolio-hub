import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type GroupBy = "all" | "month" | "quarter" | "year" | "holding";

interface DividendFiltersProps {
  groupBy: GroupBy;
  onGroupByChange: (value: GroupBy) => void;
  taxRate: number;
  onTaxRateChange: (value: number) => void;
}

export function DividendFilters({ groupBy, onGroupByChange, taxRate, onTaxRateChange }: DividendFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">קיבוץ לפי</Label>
        <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupBy)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="month">חודש</SelectItem>
            <SelectItem value="quarter">רבעון</SelectItem>
            <SelectItem value="year">שנה</SelectItem>
            <SelectItem value="holding">נייר ערך</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">שיעור מס (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={taxRate}
          onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
          className="w-[90px]"
          dir="ltr"
        />
      </div>
    </div>
  );
}
