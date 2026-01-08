import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AllocationCategory {
  id: string;
  name: string;
  targetPercentage: number;
  currentPercentage: number;
  color: string;
}

const colorOptions = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16"
];

export default function Allocations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [categories, setCategories] = useState<AllocationCategory[]>([
    { id: "1", name: "מניות ארה״ב", targetPercentage: 40, currentPercentage: 38, color: "#3b82f6" },
    { id: "2", name: "קרנות כספיות", targetPercentage: 25, currentPercentage: 28, color: "#10b981" },
    { id: "3", name: "ETF בינלאומי", targetPercentage: 20, currentPercentage: 19, color: "#f59e0b" },
    { id: "4", name: "מניות ישראל", targetPercentage: 15, currentPercentage: 15, color: "#8b5cf6" },
  ]);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  const { toast } = useToast();

  const handleAddCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newCategory: AllocationCategory = {
      id: crypto.randomUUID(),
      name: formData.get("name") as string,
      targetPercentage: parseFloat(formData.get("target") as string) || 0,
      currentPercentage: 0,
      color: selectedColor,
    };

    setCategories([...categories, newCategory]);
    setIsDialogOpen(false);
    toast({
      title: "נוסף בהצלחה",
      description: `קטגוריה "${newCategory.name}" נוספה`,
    });
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter(c => c.id !== id));
    toast({
      title: "נמחק",
      description: "הקטגוריה הוסרה",
    });
  };

  const totalTarget = categories.reduce((sum, c) => sum + c.targetPercentage, 0);
  const totalCurrent = categories.reduce((sum, c) => sum + c.currentPercentage, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">הקצאות</h1>
            <p className="text-muted-foreground">הגדר והשווה הקצאת נכסים יעד מול בפועל</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                הוסף קטגוריה
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף קטגוריית הקצאה</DialogTitle>
                <DialogDescription>
                  הגדר קטגוריה חדשה עם יעד הקצאה
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">שם הקטגוריה</Label>
                  <Input id="name" name="name" placeholder="מניות צמיחה" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="target">יעד הקצאה (%)</Label>
                  <Input 
                    id="target" 
                    name="target" 
                    type="number" 
                    min="0" 
                    max="100" 
                    placeholder="20" 
                    required 
                    dir="ltr"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>צבע</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          selectedColor === color ? 'scale-125 ring-2 ring-offset-2 ring-primary' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <Button type="submit" className="w-full">הוסף</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">סה״כ יעד</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalTarget === 100 ? 'text-green-500' : 'text-yellow-500'}`}>
                {totalTarget}%
              </div>
              <p className="text-xs text-muted-foreground">
                {totalTarget === 100 ? 'מאוזן ✓' : totalTarget < 100 ? `חסר ${100 - totalTarget}%` : `עודף ${totalTarget - 100}%`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">סה״כ בפועל</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalCurrent}%
              </div>
              <p className="text-xs text-muted-foreground">
                הקצאה נוכחית
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((category) => {
            const diff = category.currentPercentage - category.targetPercentage;
            const isOverweight = diff > 0;
            const isUnderweight = diff < 0;
            
            return (
              <Card key={category.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <CardTitle className="text-base">{category.name}</CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteCategory(category.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>יעד: {category.targetPercentage}%</span>
                    <span>בפועל: {category.currentPercentage}%</span>
                  </div>
                  <Progress 
                    value={(category.currentPercentage / category.targetPercentage) * 100} 
                    className="h-2"
                  />
                  <div className={`text-sm ${
                    isOverweight ? 'text-yellow-500' : 
                    isUnderweight ? 'text-blue-500' : 
                    'text-green-500'
                  }`}>
                    {isOverweight && `עודף משקל +${diff}%`}
                    {isUnderweight && `חסר משקל ${diff}%`}
                    {diff === 0 && 'מאוזן ✓'}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
