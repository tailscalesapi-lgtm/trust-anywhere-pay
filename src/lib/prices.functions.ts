import { createServerFn } from "@tanstack/react-start";

// CoinGecko ids for our supported assets
const ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  LTC: "litecoin",
  USDT: "tether",
  ETH: "ethereum",
  USDC: "usd-coin",
  XMR: "monero",
  SOL: "solana",
  DOGE: "dogecoin",
  BCH: "bitcoin-cash",
  TRX: "tron",
};

type PriceMap = Record<string, number>;

let cache: { at: number; data: PriceMap } | null = null;
const TTL_MS = 60_000;

async function fetchPrices(symbols: string[]): Promise<PriceMap> {
  const ids = symbols.map((s) => ID_MAP[s]).filter(Boolean).join(",");
  if (!ids) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Price API ${res.status}`);
  const j: any = await res.json();
  const out: PriceMap = {};
  for (const sym of symbols) {
    const id = ID_MAP[sym];
    const p = id ? j?.[id]?.usd : undefined;
    if (typeof p === "number") out[sym] = p;
  }
  return out;
}

export const getPrices = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const symbols = Object.keys(ID_MAP);
    const data = await fetchPrices(symbols);
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? {};
  }
});
