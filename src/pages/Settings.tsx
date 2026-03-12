import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { User, Globe, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const { profile, updateProfile, isLoading } = useProfile();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setCurrency(profile.preferred_currency || "ILS");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    await updateProfile.mutateAsync({
      display_name: displayName,
      preferred_currency: currency,
    });
    toast({ title: "נשמר בהצלחה", description: "ההגדרות עודכנו" });
  };

  const handleResetData = async () => {
    if (!user?.id) return;
    setIsResetting(true);
    try {
      await supabase.from('dividends').delete().eq('user_id', user.id);
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('holding_categories').delete().eq('user_id', user.id);
      await supabase.from('stock_splits').delete().eq('user_id', user.id);
      await supabase.from('holdings').delete().eq('user_id', user.id);
      
      toast({ title: "הנתונים נמחקו", description: "כל ההחזקות, העסקאות והדיבידנדים נמחקו" });
      window.location.reload();
    } catch {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן למחוק נתונים" });
    } finally {
      setIsResetting(false);
      setResetConfirmText("");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">הגדרות</h1>
          <p className="text-muted-foreground">נהל את הגדרות החשבון שלך</p>
        </div>

        {/* Profile & Preferences combined */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle>פרופיל והעדפות</CardTitle>
                <CardDescription>פרטי החשבון והתאמה אישית</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">אימייל</Label>
                  <Input id="email" value={user?.email || ""} disabled dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">שם תצוגה</Label>
                  <Input 
                    id="displayName" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="השם שלך"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">
                    <Globe className="inline w-4 h-4 ml-1" />
                    מטבע ברירת מחדל
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ILS">₪ שקל ישראלי</SelectItem>
                      <SelectItem value="USD">$ דולר אמריקאי</SelectItem>
                      <SelectItem value="CAD">C$ דולר קנדי</SelectItem>
                      <SelectItem value="EUR">€ אירו</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleSaveProfile}
                  disabled={updateProfile.isPending}
                  className="w-full"
                >
                  {updateProfile.isPending ? "שומר..." : "שמור שינויים"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-destructive" />
              <div>
                <CardTitle className="text-destructive">אזור מסוכן</CardTitle>
                <CardDescription>פעולות בלתי הפיכות</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="ml-2 h-4 w-4" />
                  מחק את כל הנתונים
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>איפוס כל הנתונים</AlertDialogTitle>
                  <AlertDialogDescription>
                    פעולה זו תמחק את כל ההחזקות, העסקאות והדיבידנדים שלך.
                    <br />
                    <strong className="text-destructive">פעולה זו בלתי הפיכה!</strong>
                    <br /><br />
                    כדי לאשר, הקלד <strong>מחק הכל</strong> בשדה למטה:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="confirm-reset">אישור מחיקה</Label>
                  <Input
                    id="confirm-reset"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder='הקלד "מחק הכל"'
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel onClick={() => setResetConfirmText("")}>ביטול</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetData}
                    disabled={resetConfirmText !== "מחק הכל" || isResetting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isResetting ? "מוחק..." : "מחק הכל"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-xs text-muted-foreground mt-3">
              פעולה זו תמחק את כל ההחזקות, העסקאות, הדיבידנדים וההקצאות שלך. לא ניתן לשחזר נתונים אלו.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
