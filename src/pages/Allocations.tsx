import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useAllocations } from "@/hooks/useAllocations";
import { Skeleton } from "@/components/ui/skeleton";

const colorOptions = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16"
];

export default function Allocations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  
  const { categories, createCategory, deleteCategory, totalTarget, isLoading } = useAllocations();

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await createCategory.mutateAsync({
      name: formData.get("name") as string,
      target_percentage: parseFloat(formData.get("target") as string) || 0,
      color: selectedColor,
    });

    setIsDialogOpen(false);
    setSelectedColor(colorOptions[0]);
  };

  const handleDelete = async (id: string) => {
    await deleteCategory.mutateAsync(id);
  };

  // For now, current percentage is not calculated (would need to link holdings to categories)
  const getCurrentPercentage = () => 0;

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
                
                <Button type="submit" className="w-full" disabled={createCategory.isPending}>
                  {createCategory.isPending ? "מוסיף..." : "הוסף"}
                </Button>
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
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${totalTarget === 100 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {totalTarget}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalTarget === 100 ? 'מאוזן ✓' : totalTarget < 100 ? `חסר ${100 - totalTarget}%` : `עודף ${totalTarget - 100}%`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">סה״כ בפועל</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                0%
              </div>
              <p className="text-xs text-muted-foreground">
                הקצאה נוכחית (יחושב אוטומטית)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין קטגוריות</h3>
              <p className="text-muted-foreground text-center mb-4">
                הוסף קטגוריות הקצאה לניהול הפורטפוליו
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="ml-2 h-4 w-4" />
                הוסף קטגוריה
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((category) => {
              const currentPercentage = getCurrentPercentage();
              const targetPercentage = category.target_percentage ?? 0;
              const diff = currentPercentage - targetPercentage;
              const isOverweight = diff > 0;
              const isUnderweight = diff < 0;
              
              return (
                <Card key={category.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: category.color || "#3b82f6" }}
                        />
                        <CardTitle className="text-base">{category.name}</CardTitle>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(category.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>יעד: {targetPercentage}%</span>
                      <span>בפועל: {currentPercentage}%</span>
                    </div>
                    <Progress 
                      value={targetPercentage > 0 ? (currentPercentage / targetPercentage) * 100 : 0} 
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
        )}
      </div>
    </AppLayout>
  );
}
