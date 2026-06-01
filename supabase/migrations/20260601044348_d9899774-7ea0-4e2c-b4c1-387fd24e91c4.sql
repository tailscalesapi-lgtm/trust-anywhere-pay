
-- Trades
CREATE TABLE public.trades (
  id text PRIMARY KEY,
  password_hash text NOT NULL,
  creator_role text NOT NULL CHECK (creator_role IN ('buyer','seller')),
  payment_method text NOT NULL DEFAULT 'BTC',
  name text NOT NULL,
  amount numeric NOT NULL,
  agreement text NOT NULL,
  finalization_hours integer NOT NULL,
  deposit_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending_deposit'
    CHECK (status IN ('pending_deposit','funded','completed','disputed','cancelled','refunded')),
  funded_at timestamptz,
  finalization_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id text NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE public.dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('buyer','seller','moderator')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- All access via server-side admin client + password check. Lock down client.
GRANT ALL ON public.trades TO service_role;
GRANT ALL ON public.disputes TO service_role;
GRANT ALL ON public.dispute_messages TO service_role;

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- No policies = no anon/authenticated access. Service role bypasses RLS.
