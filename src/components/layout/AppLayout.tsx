import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Menu } from "lucide-react";
import { EventNotifications } from "@/components/EventNotifications";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir="rtl">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background">
            <div className="flex items-center">
              <SidebarTrigger className="ml-4">
                <Menu className="w-5 h-5" />
              </SidebarTrigger>
              <h1 className="text-lg font-semibold">ניהול פורטפוליו</h1>
            </div>
            <EventNotifications />
          </header>
          <div className="flex-1 p-6 bg-muted/30">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
