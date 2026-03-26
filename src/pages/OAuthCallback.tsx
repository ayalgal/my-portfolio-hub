import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    async function handleCallback() {
      try {
        const { data, error } = await supabase.auth.getSessionFromUrl();
        if (error) {
          toast({
            variant: "destructive",
            title: "שגיאה באימות OAuth",
            description: error.message,
          });
          navigate("/auth", { replace: true });
          return;
        }

        if (!data?.session) {
          toast({
            variant: "destructive",
            title: "כשל באימות",
            description: "לא נמצאה סשן OAuth",
          });
          navigate("/auth", { replace: true });
          return;
        }

        toast({
          title: "התחברת בהצלחה",
          description: "נכנסת דרך Google",
        });

        navigate("/dashboard", { replace: true });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "שגיאה בלתי צפויה",
          description: err instanceof Error ? err.message : "תקלת רשת",
        });
        navigate("/auth", { replace: true });
      }
    }

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>טוען אימות Google...</div>
    </div>
  );
}
