
CREATE TABLE public.stock_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  holding_id UUID REFERENCES public.holdings(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'split', 'reverse_split', 'spinoff', 'dividend_declared', 'dividend_cut', 'dividend_increase'
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.stock_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own events" ON public.stock_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
