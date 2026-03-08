
CREATE TABLE public.stock_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id uuid NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  split_date date NOT NULL,
  ratio_from numeric NOT NULL,
  ratio_to numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  detected_at timestamp with time zone DEFAULT now(),
  applied_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.stock_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own splits"
ON public.stock_splits
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_stock_splits_unique ON public.stock_splits (holding_id, split_date, ratio_from, ratio_to);
