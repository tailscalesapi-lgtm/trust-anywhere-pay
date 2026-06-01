import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminSession = { authed?: boolean; loginAt?: number };

function sessionConfig() {
  const pw = process.env.ADMIN_SESSION_SECRET;
  if (!pw || pw.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be set (min 32 chars)");
  }
  return {
    password: pw,
    name: "ft_admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/" },
  };
}

async function session() {
  return useSession<AdminSession>(sessionConfig());
}

async function requireAdmin() {
  const s = await session();
  if (!s.data.authed) throw new Error("Unauthorized");
  return s;
}

async function audit(action: string, target?: string | null, payload?: unknown) {
  await supabaseAdmin.from("admin_audit_log").insert({
    action,
    target: target ?? null,
    payload: (payload as any) ?? null,
  });
}

// ---------- Auth ----------
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("Admin not configured");
    if (data.password !== expected) {
      await new Promise((r) => setTimeout(r, 600));
      throw new Error("Invalid password");
    }
    const s = await session();
    await s.update({ authed: true, loginAt: Date.now() });
    await audit("admin_login");
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const s = await session();
  await s.clear();
  return { ok: true };
});

export const adminMe = createServerFn({ method: "GET" }).handler(async () => {
  const s = await session();
  return { authed: !!s.data.authed };
});

// ---------- Dashboard ----------
export const adminGetDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const [assets, addresses, settings, trades, disputes, logs] = await Promise.all([
    supabaseAdmin.from("crypto_assets").select("*").order("sort_order").order("symbol"),
    supabaseAdmin.from("crypto_deposit_addresses").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("app_settings").select("*"),
    supabaseAdmin
      .from("trades")
      .select("id,name,amount,payment_method,status,creator_role,deposit_address,created_at,funded_at,finalization_deadline")
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin.from("disputes").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(80),
  ]);

  const settingsMap: Record<string, any> = {};
  for (const r of settings.data ?? []) settingsMap[r.key] = r.value;

  const tradesArr = trades.data ?? [];
  const sum = (s: string) => tradesArr.filter((t) => t.status === s).length;
  const volume: Record<string, number> = {};
  for (const t of tradesArr) {
    if (t.status === "completed" || t.status === "funded") {
      volume[t.payment_method] = (volume[t.payment_method] ?? 0) + Number(t.amount);
    }
  }

  return {
    assets: assets.data ?? [],
    addresses: addresses.data ?? [],
    settings: settingsMap,
    trades: tradesArr,
    disputes: disputes.data ?? [],
    logs: logs.data ?? [],
    counts: {
      total: tradesArr.length,
      pending: sum("pending_deposit"),
      funded: sum("funded"),
      completed: sum("completed"),
      disputed: sum("disputed"),
      cancelled: sum("cancelled"),
    },
    volume,
  };
});

// ---------- Assets ----------
const assetSchema = z.object({
  id: z.string().uuid().optional(),
  symbol: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]+$/)),
  name: z.string().trim().min(1).max(80),
  network: z.string().trim().min(1).max(40),
  decimals: z.number().int().min(0).max(18),
  min_amount: z.number().min(0),
  max_amount: z.number().positive().nullable().optional(),
  explorer_tx_url: z.string().url().nullable().optional().or(z.literal("")),
  explorer_addr_url: z.string().url().nullable().optional().or(z.literal("")),
  enabled: z.boolean(),
  sort_order: z.number().int().default(0),
});

export const adminSaveAsset = createServerFn({ method: "POST" })
  .inputValidator((d) => assetSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const row = {
      symbol: data.symbol,
      name: data.name,
      network: data.network,
      decimals: data.decimals,
      min_amount: data.min_amount,
      max_amount: data.max_amount || null,
      explorer_tx_url: data.explorer_tx_url || null,
      explorer_addr_url: data.explorer_addr_url || null,
      enabled: data.enabled,
      sort_order: data.sort_order,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("crypto_assets").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit("asset_update", data.id, row);
    } else {
      const { error } = await supabaseAdmin.from("crypto_assets").insert(row);
      if (error) throw new Error(error.message);
      await audit("asset_create", data.symbol, row);
    }
    return { ok: true };
  });

export const adminDeleteAsset = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("crypto_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("asset_delete", data.id);
    return { ok: true };
  });

// ---------- Deposit addresses ----------
export const adminAddAddress = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        asset_id: z.string().uuid(),
        address: z.string().trim().min(8).max(200),
        label: z.string().trim().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("crypto_deposit_addresses").insert({
      asset_id: data.asset_id,
      address: data.address,
      label: data.label || null,
    });
    if (error) throw new Error(error.message);
    await audit("address_add", data.asset_id, { address: data.address });
    return { ok: true };
  });

export const adminToggleAddress = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("crypto_deposit_addresses")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("address_toggle", data.id, { enabled: data.enabled });
    return { ok: true };
  });

export const adminDeleteAddress = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("crypto_deposit_addresses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("address_delete", data.id);
    return { ok: true };
  });

// ---------- Settings ----------
export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        fee_percent: z.number().min(0).max(50),
        announcement: z.object({ enabled: z.boolean(), text: z.string().max(500) }),
        site_name: z.string().trim().min(1).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const now = new Date().toISOString();
    const rows = [
      { key: "fee_percent", value: data.fee_percent as any, updated_at: now },
      { key: "announcement", value: data.announcement as any, updated_at: now },
      { key: "site_name", value: data.site_name as any, updated_at: now },
    ];
    for (const r of rows) {
      const { error } = await supabaseAdmin.from("app_settings").upsert(r);
      if (error) throw new Error(error.message);
    }
    await audit("settings_update", null, data);
    return { ok: true };
  });

// ---------- Trade admin actions ----------
export const adminForceStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
        status: z.enum([
          "pending_deposit",
          "funded",
          "completed",
          "cancelled",
          "disputed",
          "refunded",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("trades")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("trade_force_status", data.id, { status: data.status });
    return { ok: true };
  });

export const adminUpdateTradeAddress = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string(), address: z.string().trim().min(8).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("trades")
      .update({ deposit_address: data.address, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("trade_update_address", data.id, { address: data.address });
    return { ok: true };
  });
