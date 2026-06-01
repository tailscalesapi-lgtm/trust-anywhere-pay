import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Layout, Panel } from "@/components/Layout";
import {
  adminAddAddress,
  adminDeleteAddress,
  adminDeleteAsset,
  adminForceStatus,
  adminGetDashboard,
  adminLogin,
  adminLogout,
  adminMe,
  adminSaveAsset,
  adminSaveSettings,
  adminToggleAddress,
  adminUpdateTradeAddress,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Fair Trade" },
      { name: "description", content: "Internal admin panel." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

type Tab = "overview" | "assets" | "addresses" | "trades" | "disputes" | "settings" | "audit";

function AdminPage() {
  const me = useServerFn(adminMe);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    me().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false));
  }, []);

  if (authed === null)
    return (
      <Layout>
        <Panel>Loading…</Panel>
      </Layout>
    );
  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} />;
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const login = useServerFn(adminLogin);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login({ data: { password: pw } });
      onSuccess();
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <Panel className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Admin Login</h1>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Admin password"
            className="w-full bg-card text-card-foreground rounded px-3 py-2"
          />
          {err && <p className="text-destructive text-sm">{err}</p>}
          <button
            disabled={busy}
            className="px-5 py-2 bg-cyan-brand text-black rounded font-semibold disabled:opacity-50"
          >
            {busy ? "…" : "Sign in"}
          </button>
        </form>
      </Panel>
    </Layout>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const get = useServerFn(adminGetDashboard);
  const logout = useServerFn(adminLogout);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const reload = () => get().then(setData).catch(() => setData(null));
  useEffect(() => {
    reload();
  }, []);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  if (!data)
    return (
      <Layout>
        <Panel>Loading admin data…</Panel>
      </Layout>
    );

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "assets", label: "Cryptos", count: data.assets.length },
    { id: "addresses", label: "Addresses", count: data.addresses.length },
    { id: "trades", label: "Trades", count: data.counts.total },
    { id: "disputes", label: "Disputes", count: data.disputes.length },
    { id: "settings", label: "Settings" },
    { id: "audit", label: "Audit" },
  ];

  return (
    <Layout>
      <Panel className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <button onClick={handleLogout} className="px-3 py-1 text-sm bg-card rounded">
            Sign out
          </button>
        </div>

        <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm rounded-t ${
                tab === t.id ? "bg-cyan-brand text-black font-semibold" : "bg-card"
              }`}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span className="ml-1 opacity-70">({t.count})</span>
              )}
            </button>
          ))}
        </nav>

        {tab === "overview" && <Overview data={data} />}
        {tab === "assets" && <AssetsTab data={data} reload={reload} />}
        {tab === "addresses" && <AddressesTab data={data} reload={reload} />}
        {tab === "trades" && <TradesTab data={data} reload={reload} />}
        {tab === "disputes" && <DisputesTab data={data} />}
        {tab === "settings" && <SettingsTab data={data} reload={reload} />}
        {tab === "audit" && <AuditTab data={data} />}
      </Panel>
    </Layout>
  );
}

// ----- Tabs -----
function Overview({ data }: any) {
  const c = data.counts;
  const stat = (label: string, value: string | number) => (
    <div className="bg-card rounded p-3">
      <div className="text-xs uppercase opacity-70">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {stat("Total", c.total)}
        {stat("Pending", c.pending)}
        {stat("Funded", c.funded)}
        {stat("Completed", c.completed)}
        {stat("Disputed", c.disputed)}
        {stat("Cancelled", c.cancelled)}
      </div>
      <div>
        <h3 className="font-semibold mb-2">Locked / completed volume</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(data.volume as Record<string, number>).map(([k, v]) => (
            <div key={k} className="bg-card rounded p-3">
              <div className="text-xs uppercase opacity-70">{k}</div>
              <div className="font-semibold">{v}</div>
            </div>
          ))}
          {Object.keys(data.volume).length === 0 && (
            <p className="text-sm opacity-70">No funded trades yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetsTab({ data, reload }: any) {
  const save = useServerFn(adminSaveAsset);
  const del = useServerFn(adminDeleteAsset);
  const [editing, setEditing] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const blank = {
    symbol: "",
    name: "",
    network: "mainnet",
    decimals: 8,
    min_amount: 0,
    max_amount: null,
    explorer_tx_url: "",
    explorer_addr_url: "",
    enabled: true,
    sort_order: 0,
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Supported cryptocurrencies</h2>
        <button
          onClick={() => setEditing({ ...blank })}
          className="px-3 py-1 bg-lime-brand text-black rounded text-sm font-semibold"
        >
          + Add crypto
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left opacity-70">
            <tr>
              <th className="p-2">Symbol</th>
              <th>Name</th>
              <th>Network</th>
              <th>Min</th>
              <th>Max</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.assets.map((a: any) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2 font-mono">{a.symbol}</td>
                <td>{a.name}</td>
                <td>{a.network}</td>
                <td>{a.min_amount}</td>
                <td>{a.max_amount ?? "—"}</td>
                <td>{a.enabled ? "Yes" : "No"}</td>
                <td className="text-right">
                  <button onClick={() => setEditing(a)} className="px-2 py-1 bg-card rounded mr-1">
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ${a.symbol}? This removes its addresses too.`)) return;
                      await del({ data: { id: a.id } });
                      reload();
                    }}
                    className="px-2 py-1 bg-destructive text-destructive-foreground rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit crypto" : "Add crypto"}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              try {
                await save({
                  data: {
                    ...(editing.id ? { id: editing.id } : {}),
                    symbol: editing.symbol,
                    name: editing.name,
                    network: editing.network,
                    decimals: Number(editing.decimals),
                    min_amount: Number(editing.min_amount),
                    max_amount: editing.max_amount ? Number(editing.max_amount) : null,
                    explorer_tx_url: editing.explorer_tx_url || "",
                    explorer_addr_url: editing.explorer_addr_url || "",
                    enabled: !!editing.enabled,
                    sort_order: Number(editing.sort_order || 0),
                  },
                });
                setEditing(null);
                reload();
              } catch (e: any) {
                setErr(e?.message ?? "Save failed");
              }
            }}
            className="space-y-2"
          >
            <Row label="Symbol">
              <input
                required
                value={editing.symbol}
                onChange={(e) => setEditing({ ...editing, symbol: e.target.value })}
                className="bg-card rounded px-2 py-1 w-full uppercase"
              />
            </Row>
            <Row label="Name">
              <input
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="bg-card rounded px-2 py-1 w-full"
              />
            </Row>
            <Row label="Network">
              <input
                required
                value={editing.network}
                onChange={(e) => setEditing({ ...editing, network: e.target.value })}
                className="bg-card rounded px-2 py-1 w-full"
              />
            </Row>
            <Row label="Decimals">
              <input
                type="number"
                value={editing.decimals}
                onChange={(e) => setEditing({ ...editing, decimals: e.target.value })}
                className="bg-card rounded px-2 py-1 w-full"
              />
            </Row>
            <Row label="Min amount">
              <input
                type="number"
                step="any"
                value={editing.min_amount}
                onChange={(e) => setEditing({ ...editing, min_amount: e.target.value })}
                className="bg-card rounded px-2 py-1 w-full"
              />
            </Row>
            <Row label="Max amount (optional)">
              <input
                type="number"
                step="any"
                value={editing.max_amount ?? ""}
                onChange={(e) => setEditing({ ...editing, max_amount: e.target.value })}
                className="bg-card rounded px-2 py-1 w-full"
              />
            </Row>
            <Row label="Explorer tx URL prefix">
              <input
                value={editing.explorer_tx_url ?? ""}
                onChange={(e) => setEditing({ ...editing, explorer_tx_url: e.target.value })}
                placeholder="https://mempool.space/tx/"
                className="bg-card rounded px-2 py-1 w-full"
              />
            </Row>
            <Row label="Explorer address URL prefix">
              <input
                value={editing.explorer_addr_url ?? ""}
                onChange={(e) => setEditing({ ...editing, explorer_addr_url: e.target.value })}
                placeholder="https://mempool.space/address/"
                className="bg-card rounded px-2 py-1 w-full"
              />
            </Row>
            <Row label="Sort order">
              <input
                type="number"
                value={editing.sort_order}
                onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })}
                className="bg-card rounded px-2 py-1 w-full"
              />
            </Row>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              />
              Enabled
            </label>
            {err && <p className="text-destructive text-sm">{err}</p>}
            <div className="flex gap-2 pt-2">
              <button className="px-4 py-2 bg-cyan-brand text-black rounded font-semibold">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 bg-card rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AddressesTab({ data, reload }: any) {
  const add = useServerFn(adminAddAddress);
  const toggle = useServerFn(adminToggleAddress);
  const del = useServerFn(adminDeleteAddress);
  const [assetId, setAssetId] = useState(data.assets[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const bySymbol: Record<string, string> = {};
  for (const a of data.assets) bySymbol[a.id] = a.symbol;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await add({ data: { asset_id: assetId, address: address.trim(), label: label.trim() } });
      setAddress("");
      setLabel("");
      reload();
    } catch (e: any) {
      setErr(e?.message ?? "Add failed");
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="bg-card/40 p-3 rounded space-y-2">
        <h3 className="font-semibold">Add a deposit address</h3>
        <div className="grid sm:grid-cols-4 gap-2">
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="bg-card rounded px-2 py-2"
          >
            {data.assets.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.symbol} — {a.name}
              </option>
            ))}
          </select>
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            className="bg-card rounded px-2 py-2 sm:col-span-2"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="bg-card rounded px-2 py-2"
          />
        </div>
        {err && <p className="text-destructive text-sm">{err}</p>}
        <button className="px-4 py-2 bg-lime-brand text-black rounded font-semibold">Add</button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left opacity-70">
            <tr>
              <th className="p-2">Asset</th>
              <th>Address</th>
              <th>Label</th>
              <th>Used</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.addresses.map((a: any) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2 font-mono">{bySymbol[a.asset_id] ?? "?"}</td>
                <td className="font-mono break-all">{a.address}</td>
                <td>{a.label ?? "—"}</td>
                <td>{a.use_count}</td>
                <td>
                  <button
                    onClick={async () => {
                      await toggle({ data: { id: a.id, enabled: !a.enabled } });
                      reload();
                    }}
                    className={`px-2 py-1 rounded text-xs ${
                      a.enabled ? "bg-lime-brand text-black" : "bg-card"
                    }`}
                  >
                    {a.enabled ? "Yes" : "No"}
                  </button>
                </td>
                <td className="text-right">
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this address?")) return;
                      await del({ data: { id: a.id } });
                      reload();
                    }}
                    className="px-2 py-1 bg-destructive text-destructive-foreground rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TradesTab({ data, reload }: any) {
  const force = useServerFn(adminForceStatus);
  const updAddr = useServerFn(adminUpdateTradeAddress);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left opacity-70">
          <tr>
            <th className="p-2">ID</th>
            <th>Name</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Created</th>
            <th>Address</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.trades.map((t: any) => (
            <tr key={t.id} className="border-t border-border align-top">
              <td className="p-2 font-mono">{t.id}</td>
              <td>{t.name}</td>
              <td>
                {t.amount} {t.payment_method}
              </td>
              <td>
                <select
                  defaultValue={t.status}
                  onChange={async (e) => {
                    if (e.target.value === t.status) return;
                    if (!confirm(`Force status to ${e.target.value}?`)) return;
                    await force({ data: { id: t.id, status: e.target.value as any } });
                    reload();
                  }}
                  className="bg-card rounded px-2 py-1 text-xs"
                >
                  {[
                    "pending_deposit",
                    "funded",
                    "completed",
                    "cancelled",
                    "disputed",
                    "refunded",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td className="text-xs opacity-70">
                {new Date(t.created_at).toLocaleString()}
              </td>
              <td className="font-mono text-xs break-all max-w-[14rem]">{t.deposit_address}</td>
              <td>
                <button
                  className="px-2 py-1 bg-card rounded text-xs"
                  onClick={async () => {
                    const a = prompt("New deposit address:", t.deposit_address);
                    if (!a) return;
                    await updAddr({ data: { id: t.id, address: a.trim() } });
                    reload();
                  }}
                >
                  Change addr
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DisputesTab({ data }: any) {
  if (data.disputes.length === 0) return <p className="opacity-70">No disputes.</p>;
  return (
    <ul className="space-y-2">
      {data.disputes.map((d: any) => (
        <li key={d.id} className="bg-card rounded p-3 text-sm">
          <div className="flex justify-between">
            <span className="font-mono">{d.trade_id}</span>
            <span>{d.status}</span>
          </div>
          <div className="opacity-70 text-xs">{new Date(d.created_at).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
}

function SettingsTab({ data, reload }: any) {
  const save = useServerFn(adminSaveSettings);
  const [fee, setFee] = useState(String(data.settings.fee_percent ?? 1));
  const [siteName, setSiteName] = useState(String(data.settings.site_name ?? "Fair Trade"));
  const [annEnabled, setAnnEnabled] = useState(!!data.settings.announcement?.enabled);
  const [annText, setAnnText] = useState(String(data.settings.announcement?.text ?? ""));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 max-w-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setMsg(null);
        try {
          await save({
            data: {
              fee_percent: Number(fee),
              announcement: { enabled: annEnabled, text: annText },
              site_name: siteName,
            },
          });
          setMsg("Saved.");
          reload();
        } catch (e: any) {
          setErr(e?.message ?? "Save failed");
        }
      }}
    >
      <Row label="Site name">
        <input
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          className="bg-card rounded px-2 py-1 w-full"
        />
      </Row>
      <Row label="Escrow fee (%)">
        <input
          type="number"
          step="0.01"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          className="bg-card rounded px-2 py-1 w-full"
        />
      </Row>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={annEnabled}
          onChange={(e) => setAnnEnabled(e.target.checked)}
        />
        Show announcement banner
      </label>
      <Row label="Announcement text">
        <input
          value={annText}
          onChange={(e) => setAnnText(e.target.value)}
          className="bg-card rounded px-2 py-1 w-full"
        />
      </Row>
      {err && <p className="text-destructive text-sm">{err}</p>}
      {msg && <p className="text-lime-brand text-sm">{msg}</p>}
      <button className="px-4 py-2 bg-cyan-brand text-black rounded font-semibold">Save</button>
    </form>
  );
}

function AuditTab({ data }: any) {
  return (
    <ul className="space-y-1 text-sm font-mono">
      {data.logs.map((l: any) => (
        <li key={l.id} className="bg-card/60 rounded px-2 py-1">
          <span className="opacity-70">{new Date(l.created_at).toLocaleString()}</span>{" "}
          <span className="text-cyan-brand">{l.action}</span>{" "}
          {l.target && <span className="opacity-80">{l.target}</span>}
        </li>
      ))}
    </ul>
  );
}

// ----- helpers -----
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm mb-1 opacity-80">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-panel rounded-lg p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
