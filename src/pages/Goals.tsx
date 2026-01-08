import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Target, Home, GraduationCap, Plane, Briefcase, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvestmentGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  retirement: Briefcase,
  house: Home,
  education: GraduationCap,
  vacation: Plane,
  other: Target,
};

const categoryLabels: Record<string, string> = {
  retirement: "פנסיה",
  house: "דירה",
  education: "לימודים",
  vacation: "חופשה",
  other: "אחר",
};

export default function Goals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [goals, setGoals] = useState<InvestmentGoal[]>([
    {
      id: "1",
      name: "קרן חירום",
      targetAmount: 50000,
      currentAmount: 32000,
      targetDate: "2024-12-31",
      category: "other",
    },
    {
      id: "2",
      name: "מקדמה לדירה",
      targetAmount: 200000,
      currentAmount: 85000,
      targetDate: "2026-06-01",
      category: "house",
    },
  ]);
  const { toast } = useToast();

  const handleAddGoal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newGoal: InvestmentGoal = {
      id: crypto.randomUUID(),
      name: formData.get("name") as string,
      targetAmount: parseFloat(formData.get("targetAmount") as string) || 0,
      currentAmount: parseFloat(formData.get("currentAmount") as string) || 0,
      targetDate: formData.get("targetDate") as string,
      category: formData.get("category") as string,
    };

    setGoals([...goals, newGoal]);
    setIsDialogOpen(false);
    toast({
      title: "יעד נוסף",
      description: `יעד "${newGoal.name}" נוסף בהצלחה`,
    });
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
    toast({
      title: "נמחק",
      description: "היעד הוסר",
    });
  };

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">יעדי השקעה</h1>
            <p className="text-muted-foreground">הגדר יעדים ועקוב אחר ההתקדמות שלך</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                הוסף יעד
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף יעד השקעה</DialogTitle>
                <DialogDescription>
                  הגדר יעד חדש למעקב
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">שם היעד</Label>
                  <Input id="name" name="name" placeholder="קרן חירום" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">קטגוריה</Label>
                  <Select name="category" defaultValue="other">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retirement">פנסיה</SelectItem>
                      <SelectItem value="house">דירה</SelectItem>
                      <SelectItem value="education">לימודים</SelectItem>
                      <SelectItem value="vacation">חופשה</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetAmount">סכום יעד (₪)</Label>
                    <Input 
                      id="targetAmount" 
                      name="targetAmount" 
                      type="number" 
                      placeholder="100000" 
                      required 
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentAmount">סכום נוכחי (₪)</Label>
                    <Input 
                      id="currentAmount" 
                      name="currentAmount" 
                      type="number" 
                      placeholder="0" 
                      dir="ltr"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="targetDate">תאריך יעד</Label>
                  <Input 
                    id="targetDate" 
                    name="targetDate" 
                    type="date" 
                    required 
                    dir="ltr"
                  />
                </div>
                
                <Button type="submit" className="w-full">הוסף</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">סה״כ יעדים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₪{totalTarget.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                ב-{goals.length} יעדים
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">סכום נוכחי</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ₪{totalCurrent.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {((totalCurrent / totalTarget) * 100).toFixed(1)}% מהיעד
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">נותר</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                ₪{(totalTarget - totalCurrent).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                להשגת כל היעדים
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Goals Grid */}
        {goals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין יעדים עדיין</h3>
              <p className="text-muted-foreground text-center mb-4">
                הגדר יעדי השקעה לעקוב אחר ההתקדמות שלך
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="ml-2 h-4 w-4" />
                הוסף יעד ראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => {
              const progress = (goal.currentAmount / goal.targetAmount) * 100;
              const remaining = goal.targetAmount - goal.currentAmount;
              const Icon = categoryIcons[goal.category] || Target;
              const daysLeft = Math.ceil(
                (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              
              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{goal.name}</CardTitle>
                          <CardDescription>{categoryLabels[goal.category]}</CardDescription>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteGoal(goal.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>₪{goal.currentAmount.toLocaleString()}</span>
                        <span className="text-muted-foreground">₪{goal.targetAmount.toLocaleString()}</span>
                      </div>
                      <Progress value={progress} className="h-3" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress.toFixed(1)}% הושג</span>
                        <span>נותר ₪{remaining.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">תאריך יעד</span>
                      <span className="text-sm font-medium">
                        {new Date(goal.targetDate).toLocaleDateString('he-IL')}
                        {daysLeft > 0 && (
                          <span className="text-muted-foreground mr-2">
                            ({daysLeft} ימים)
                          </span>
                        )}
                      </span>
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
