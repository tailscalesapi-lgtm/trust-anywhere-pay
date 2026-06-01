INSERT INTO public.crypto_assets (symbol, name, network, decimals, min_amount, enabled, sort_order, explorer_tx_url, explorer_addr_url)
SELECT 'LTC', 'Litecoin', 'mainnet', 8, 0.001, true, 2, 'https://blockchair.com/litecoin/transaction/', 'https://blockchair.com/litecoin/address/'
WHERE NOT EXISTS (SELECT 1 FROM public.crypto_assets WHERE symbol='LTC');

INSERT INTO public.crypto_assets (symbol, name, network, decimals, min_amount, enabled, sort_order, explorer_tx_url, explorer_addr_url)
SELECT 'USDT', 'Tether (TRC20)', 'tron', 6, 1, true, 3, 'https://tronscan.org/#/transaction/', 'https://tronscan.org/#/address/'
WHERE NOT EXISTS (SELECT 1 FROM public.crypto_assets WHERE symbol='USDT');