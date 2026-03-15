import { useState } from "react";
import { Bell, SplitSquareVertical, TrendingUp, TrendingDown, AlertTriangle, DollarSign, CheckCheck, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStockEvents, StockEvent } from "@/hooks/useStockEvents";
import { useNavigate } from "react-router-dom";

const eventIcons: Record<string, React.ReactNode> = {
  split: <SplitSquareVertical className="h-4 w-4 text-amber-500" />,
  reverse_split: <SplitSquareVertical className="h-4 w-4 text-orange-500" />,
  spinoff: <AlertTriangle className="h-4 w-4 text-purple-500" />,
  dividend_declared: <DollarSign className="h-4 w-4 text-green-500" />,
  dividend_cut: <TrendingDown className="h-4 w-4 text-red-500" />,
  dividend_increase: <TrendingUp className="h-4 w-4 text-green-600" />,
  insight: <Lightbulb className="h-4 w-4 text-yellow-500" />,
  yield_drop: <TrendingDown className="h-4 w-4 text-orange-500" />,
  price_up: <TrendingUp className="h-4 w-4 text-green-500" />,
  price_down: <TrendingDown className="h-4 w-4 text-red-500" />,
};

export function EventNotifications() {
  const { events, unreadCount, markAsRead, markAllAsRead, dismissEvent } = useStockEvents();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleEventClick = (event: StockEvent) => {
    if (!event.is_read) markAsRead.mutate(event.id);
    if (event.holding_id) {
      navigate(`/holding/${event.holding_id}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" dir="rtl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">התראות</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllAsRead.mutate()}>
              <CheckCheck className="h-3 w-3 ml-1" />סמן הכל כנקרא
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {events.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">אין התראות</p>
          ) : (
            <div className="divide-y">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`relative w-full text-right px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 items-start group ${!event.is_read ? 'bg-primary/5' : ''}`}
                >
                  <button
                    className="flex-1 flex gap-3 items-start text-right"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="mt-0.5">{eventIcons[event.event_type] || <AlertTriangle className="h-4 w-4" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{event.title}</span>
                        {!event.is_read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      {event.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {event.event_date ? new Date(event.event_date).toLocaleDateString('he-IL') : ''}
                        {event.created_at && ` · ${new Date(event.created_at).toLocaleDateString('he-IL')}`}
                      </p>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 flex-shrink-0 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissEvent.mutate(event.id);
                    }}
                    title="הסר התראה"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
