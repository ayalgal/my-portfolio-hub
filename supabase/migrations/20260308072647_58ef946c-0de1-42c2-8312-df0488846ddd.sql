
-- Add current_price, last_price_update, fund_number to holdings
ALTER TABLE public.holdings 
  ADD COLUMN IF NOT EXISTS current_price numeric NULL,
  ADD COLUMN IF NOT EXISTS last_price_update timestamptz NULL,
  ADD COLUMN IF NOT EXISTS fund_number text NULL;

-- Create exchange_rates table
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL DEFAULT 'ILS',
  rate numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency)
);

-- Exchange rates should be readable by all authenticated users
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read exchange rates"
  ON public.exchange_rates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage exchange rates"
  ON public.exchange_rates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
