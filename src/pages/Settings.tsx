import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { User, Globe, Palette } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("ILS");

  const handleSaveProfile = () => {
    toast({
      title: "נשמר",
      description: "הפרופיל עודכן בהצלחה",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">הגדרות</h1>
          <p className="text-muted-foreground">נהל את הגדרות החשבון שלך</p>
        </div>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle>פרופיל</CardTitle>
                <CardDescription>פרטי החשבון שלך</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input 
                id="email" 
                value={user?.email || ""} 
                disabled 
                dir="ltr"
              />
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
            <Button onClick={handleSaveProfile}>
              שמור שינויים
            </Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle>העדפות</CardTitle>
                <CardDescription>התאמה אישית של האפליקציה</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">מטבע ברירת מחדל</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">₪ שקל ישראלי</SelectItem>
                  <SelectItem value="USD">$ דולר אמריקאי</SelectItem>
                  <SelectItem value="EUR">€ אירו</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">אזור סכנה</CardTitle>
            <CardDescription>פעולות בלתי הפיכות</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive">
              מחק את כל הנתונים
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
