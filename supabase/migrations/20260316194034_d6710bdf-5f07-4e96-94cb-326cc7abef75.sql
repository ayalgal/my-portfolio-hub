
CREATE TABLE public.portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_value_ils numeric NOT NULL DEFAULT 0,
  total_cost_ils numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own snapshots"
  ON public.portfolio_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage snapshots"
  ON public.portfolio_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
