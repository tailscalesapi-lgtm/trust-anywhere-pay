import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function slug(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return s;
}

function password(len = 16) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return s;
}

async function loadAndAuth(id: string, pw: string) {
  const { data, error } = await supabaseAdmin
    .from("trades")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Trade not found");
  const ok = await bcrypt.compare(pw, data.password_hash);
  if (!ok) throw new Error("Invalid password");
  return data;
}

function publicTrade(t: any) {
  const { password_hash: _ph, ...rest } = t;
  return rest;
}

async function autoFinalize(t: any) {
  if (
    t.status === "funded" &&
    t.finalization_deadline &&
    new Date(t.finalization_deadline) <= new Date()
  ) {
    const { data } = await supabaseAdmin
      .from("trades")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", t.id)
      .select()
      .single();
    return data;
  }
  return t;
}

async function fetchAddressReceivedSats(
  address: string,
): Promise<{ received: number; confirmedReceived: number } | null> {
  try {
    const res = await fetch(`https://mempool.space/api/address/${address}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const confirmed = Number(j?.chain_stats?.funded_txo_sum ?? 0);
    const mempool = Number(j?.mempool_stats?.funded_txo_sum ?? 0);
    return { received: confirmed + mempool, confirmedReceived: confirmed };
  } catch {
    return null;
  }
}

// On-chain auto-detect (BTC only). Other assets advance via manual confirm.
async function autoDetectDeposit(t: any) {
  if (t.status !== "pending_deposit") return t;
  if (t.payment_method !== "BTC") return t;
  const requiredSats = Math.round(Number(t.amount) * 1e8);
  const stats = await fetchAddressReceivedSats(t.deposit_address);
  if (!stats) return t;
  if (stats.confirmedReceived >= requiredSats) {
    const now = new Date();
    const deadline = new Date(now.getTime() + t.finalization_hours * 3600_000);
    const { data } = await supabaseAdmin
      .from("trades")
      .update({
        status: "funded",
        funded_at: now.toISOString(),
        finalization_deadline: deadline.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", t.id)
      .eq("status", "pending_deposit")
      .select()
      .single();
    return data ?? t;
  }
  return {
    ...t,
    _onchain: {
      received_sats: stats.received,
      confirmed_sats: stats.confirmedReceived,
      required_sats: requiredSats,
    },
  };
}

// Public list of enabled assets (for new-trade form, etc.)
export const listAssets = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("crypto_assets")
    .select("symbol,name,network,decimals,min_amount,max_amount,explorer_addr_url,explorer_tx_url")
    .eq("enabled", true)
    .order("sort_order")
    .order("symbol");
  return data ?? [];
});

export const createTrade = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        role: z.enum(["buyer", "seller"]),
        payment_method: z.string().trim().min(2).max(12),
        name: z.string().trim().min(1).max(200),
        amount: z.number().positive().max(1_000_000),
        agreement: z.string().trim().min(10).max(5000),
        finalization_hours: z.number().int().min(1).max(720),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const symbol = data.payment_method.toUpperCase();
    const { data: asset } = await supabaseAdmin
      .from("crypto_assets")
      .select("id,enabled,min_amount,max_amount")
      .eq("symbol", symbol)
      .maybeSingle();
    if (!asset || !asset.enabled) throw new Error("Unsupported payment method");
    if (data.amount < Number(asset.min_amount))
      throw new Error(`Minimum is ${asset.min_amount} ${symbol}`);
    if (asset.max_amount && data.amount > Number(asset.max_amount))
      throw new Error(`Maximum is ${asset.max_amount} ${symbol}`);

    const { data: addrs } = await supabaseAdmin
      .from("crypto_deposit_addresses")
      .select("id,address,use_count")
      .eq("asset_id", asset.id)
      .eq("enabled", true)
      .order("use_count", { ascending: true })
      .limit(10);
    if (!addrs || addrs.length === 0)
      throw new Error("No deposit address available — please contact support.");
    const picked = addrs[Math.floor(Math.random() * addrs.length)];

    const id = slug(10);
    const pw = password(16);
    const password_hash = await bcrypt.hash(pw, 10);

    const { error } = await supabaseAdmin.from("trades").insert({
      id,
      password_hash,
      creator_role: data.role,
      payment_method: symbol,
      name: data.name,
      amount: data.amount,
      agreement: data.agreement,
      finalization_hours: data.finalization_hours,
      deposit_address: picked.address,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("crypto_deposit_addresses")
      .update({ use_count: (picked.use_count ?? 0) + 1 })
      .eq("id", picked.id);
    return { id, password: pw };
  });

export const getTrade = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().min(1), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    let t = await loadAndAuth(data.id, data.password);
    t = await autoFinalize(t);
    t = await autoDetectDeposit(t);
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("*")
      .eq("trade_id", t.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let messages: any[] = [];
    if (dispute) {
      const { data: msgs } = await supabaseAdmin
        .from("dispute_messages")
        .select("*")
        .eq("dispute_id", dispute.id)
        .order("created_at");
      messages = msgs || [];
    }
    return { trade: publicTrade(t), dispute, messages };
  });

export const markFunded = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string(), password: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const t = await loadAndAuth(data.id, data.password);
    if (t.status !== "pending_deposit") throw new Error("Trade is not awaiting deposit");
    if (t.payment_method === "BTC")
      throw new Error("BTC trades unlock automatically once confirmed on-chain.");
    const now = new Date();
    const deadline = new Date(now.getTime() + t.finalization_hours * 3600_000);
    const { error } = await supabaseAdmin
      .from("trades")
      .update({
        status: "funded",
        funded_at: now.toISOString(),
        finalization_deadline: deadline.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", t.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const releaseFunds = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string(), password: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const t = await loadAndAuth(data.id, data.password);
    if (t.status !== "funded") throw new Error("Trade is not funded");
    const { error } = await supabaseAdmin
      .from("trades")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelTrade = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string(), password: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const t = await loadAndAuth(data.id, data.password);
    if (t.status !== "pending_deposit") throw new Error("Only un-funded trades can be cancelled");
    const { error } = await supabaseAdmin
      .from("trades")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const openDispute = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ id: z.string(), password: z.string(), reason: z.string().trim().min(5).max(2000) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const t = await loadAndAuth(data.id, data.password);
    if (t.status !== "funded") throw new Error("Only funded trades can be disputed");
    const { data: existing } = await supabaseAdmin
      .from("disputes")
      .select("id")
      .eq("trade_id", t.id)
      .eq("status", "open")
      .maybeSingle();
    if (existing) throw new Error("Dispute already open");
    const { data: disp, error } = await supabaseAdmin
      .from("disputes")
      .insert({ trade_id: t.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("trades")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", t.id);
    await supabaseAdmin.from("dispute_messages").insert({
      dispute_id: disp.id,
      sender: t.creator_role,
      content: data.reason,
    });
    return { ok: true };
  });

export const addDisputeMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
        password: z.string(),
        sender: z.enum(["buyer", "seller"]),
        content: z.string().trim().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const t = await loadAndAuth(data.id, data.password);
    const { data: disp } = await supabaseAdmin
      .from("disputes")
      .select("id,status")
      .eq("trade_id", t.id)
      .eq("status", "open")
      .maybeSingle();
    if (!disp) throw new Error("No open dispute");
    const { error } = await supabaseAdmin.from("dispute_messages").insert({
      dispute_id: disp.id,
      sender: data.sender,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
