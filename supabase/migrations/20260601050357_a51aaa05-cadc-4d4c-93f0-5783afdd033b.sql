
-- Crypto assets
CREATE TABLE public.crypto_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  network text NOT NULL DEFAULT 'mainnet',
  decimals integer NOT NULL DEFAULT 8,
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric,
  explorer_tx_url text,
  explorer_addr_url text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crypto_assets TO service_role;
ALTER TABLE public.crypto_assets ENABLE ROW LEVEL SECURITY;

-- Deposit address pool per asset
CREATE TABLE public.crypto_deposit_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.crypto_assets(id) ON DELETE CASCADE,
  address text NOT NULL,
  label text,
  enabled boolean NOT NULL DEFAULT true,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_addr_unique ON public.crypto_deposit_addresses(asset_id, address);
CREATE INDEX idx_addr_asset ON public.crypto_deposit_addresses(asset_id) WHERE enabled;
GRANT ALL ON public.crypto_deposit_addresses TO service_role;
ALTER TABLE public.crypto_deposit_addresses ENABLE ROW LEVEL SECURITY;

-- App settings (key/value)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Admin audit log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target text,
  payload jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Seed BTC asset + existing demo addresses
INSERT INTO public.crypto_assets (symbol, name, network, decimals, explorer_tx_url, explorer_addr_url, sort_order)
VALUES ('BTC', 'Bitcoin', 'mainnet', 8,
  'https://mempool.space/tx/', 'https://mempool.space/address/', 0)
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO public.crypto_deposit_addresses (asset_id, address, label)
SELECT a.id, x.address, 'seed'
FROM public.crypto_assets a
CROSS JOIN (VALUES
  ('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'),
  ('bc1q9h0yjdupyfpxfjg24rpx755xrplvzd9hz2nj7v'),
  ('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'),
  ('bc1qa5wkgaew2dkv56kfvj49j0av5nml45x9ek9hz6')
) AS x(address)
WHERE a.symbol = 'BTC'
ON CONFLICT DO NOTHING;

-- Default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('fee_percent', '1'::jsonb),
  ('announcement', '{"enabled": false, "text": ""}'::jsonb),
  ('site_name', '"Fair Trade"'::jsonb)
ON CONFLICT (key) DO NOTHING;
