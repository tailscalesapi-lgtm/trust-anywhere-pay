import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Layout, Panel, YellowCard } from "@/components/Layout";
import {
  addDisputeMessage,
  cancelTrade,
  getTrade,
  markFunded,
  openDispute,
  releaseFunds,
} from "@/lib/trades.functions";

export const Route = createFileRoute("/trade/$id")({
  validateSearch: (s) => z.object({ pw: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Trade — Fair Trade" },
      { name: "description", content: "Manage your escrow trade." },
    ],
  }),
  component: TradePage,
});

function TradePage() {
  const { id } = Route.useParams();
  const { pw } = Route.useSearch();
  const navigate = useNavigate();
  const getTr = useServerFn(getTrade);

  const [password, setPassword] = useState(pw ?? "");
  const [entered, setEntered] = useState(!!pw);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await getTr({ data: { id, password: p } });
      setData(r);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load trade");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entered && password) load(password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  if (!entered) {
    return (
      <Layout>
        <Panel className="max-w-xl mx-auto">
          <h1 className="text-2xl mb-4">Enter Password</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Trade ID: <code>{id}</code>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEntered(true);
              navigate({ to: "/trade/$id", params: { id }, search: { pw: password }, replace: true });
            }}
            className="space-y-3"
          >
            <input
              autoFocus
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card text-card-foreground rounded px-3 py-2"
              placeholder="Trade password"
            />
            <button className="px-5 py-2 bg-cyan-brand text-black rounded font-semibold">Open</button>
          </form>
        </Panel>
      </Layout>
    );
  }

  if (loading) return <Layout><Panel>Loading…</Panel></Layout>;

  if (error) {
    return (
      <Layout>
        <Panel className="max-w-xl mx-auto space-y-3">
          <p className="text-destructive">{error}</p>
          <button
            onClick={() => { setEntered(false); }}
            className="px-4 py-2 bg-cyan-brand text-black rounded"
          >
            Try again
          </button>
        </Panel>
      </Layout>
    );
  }

  if (!data) return null;

  return <TradeView data={data} password={password} reload={() => load(password)} />;
}

function TradeView({
  data,
  password,
  reload,
}: {
  data: { trade: any; dispute: any; messages: any[] };
  password: string;
  reload: () => void;
}) {
  const { trade, dispute, messages } = data;
  const fund = useServerFn(markFunded);
  const release = useServerFn(releaseFunds);
  const cancel = useServerFn(cancelTrade);
  const dispute_ = useServerFn(openDispute);
  const sendMsg = useServerFn(addDisputeMessage);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [sender, setSender] = useState<"buyer" | "seller">(trade.creator_role);

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      reload();
    } catch (e: any) {
      setErr(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending_deposit: "bg-yellow-500",
    funded: "bg-cyan-brand",
    completed: "bg-lime-brand",
    disputed: "bg-destructive",
    cancelled: "bg-muted",
    refunded: "bg-muted",
  };

  return (
    <Layout>
      <Panel className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Trade ID</p>
            <h1 className="text-2xl font-semibold">{trade.id}</h1>
            <p className="mt-1">{trade.name}</p>
          </div>
          <span
            className={`px-3 py-1 rounded text-black text-sm font-semibold ${statusColors[trade.status] ?? "bg-muted"}`}
          >
            {trade.status.replace("_", " ")}
          </span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Info label="Amount" value={`${trade.amount} BTC`} />
          <Info label="Payment" value={trade.payment_method} />
          <Info label="Creator role" value={trade.creator_role} />
          <Info label="Finalization" value={`${trade.finalization_hours} h`} />
          {trade.finalization_deadline && (
            <Info label="Deadline" value={new Date(trade.finalization_deadline).toLocaleString()} />
          )}
        </div>

        <YellowCard>
          <p className="font-semibold mb-1">Trade Agreement</p>
          <p className="whitespace-pre-wrap">{trade.agreement}</p>
        </YellowCard>

        {trade.status === "pending_deposit" && (
          <YellowCard className="space-y-2">
            <p className="font-semibold">Send exactly {trade.amount} BTC to:</p>
            <code className="block bg-black/10 rounded px-3 py-2 break-all">{trade.deposit_address}</code>
            <p className="text-sm">
              The Bitcoin network is monitored automatically. As soon as your transaction is
              confirmed (1+ confirmation), the trade unlocks and the seller is notified.
            </p>
            {trade._onchain && (
              <div className="text-sm bg-black/10 rounded p-2 space-y-1">
                <p>
                  Confirmed received: <strong>{(trade._onchain.confirmed_sats / 1e8).toFixed(8)} BTC</strong>
                </p>
                {trade._onchain.received_sats > trade._onchain.confirmed_sats && (
                  <p>
                    In mempool (unconfirmed):{" "}
                    <strong>
                      {((trade._onchain.received_sats - trade._onchain.confirmed_sats) / 1e8).toFixed(8)} BTC
                    </strong>
                  </p>
                )}
                <p>
                  Required: <strong>{(trade._onchain.required_sats / 1e8).toFixed(8)} BTC</strong>
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => { reload(); }}
                className="px-4 py-2 bg-black text-white rounded"
              >
                Check now
              </button>
              <a
                href={`https://mempool.space/address/${trade.deposit_address}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-cyan-brand text-black rounded font-semibold"
              >
                View on explorer
              </a>
              <button
                disabled={busy}
                onClick={() => run(() => cancel({ data: { id: trade.id, password } }))}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded"
              >
                Cancel trade
              </button>
            </div>
          </YellowCard>
        )}

        {trade.status === "funded" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Funds are locked. The buyer can release at any time. Otherwise funds auto-release to
              the seller when the timer expires.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                disabled={busy}
                onClick={() => run(() => release({ data: { id: trade.id, password } }))}
                className="px-4 py-2 bg-lime-brand text-black rounded font-semibold"
              >
                Release funds to seller
              </button>
            </div>
            <details className="bg-panel rounded p-3">
              <summary className="cursor-pointer font-semibold">Open a dispute</summary>
              <div className="mt-3 space-y-2">
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe what's wrong (min 5 chars)"
                  className="w-full bg-card text-card-foreground rounded px-3 py-2"
                />
                <button
                  disabled={busy || reason.trim().length < 5}
                  onClick={() =>
                    run(() => dispute_({ data: { id: trade.id, password, reason } }))
                  }
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded"
                >
                  Open dispute
                </button>
              </div>
            </details>
          </div>
        )}

        {dispute && (
          <YellowCard className="space-y-3">
            <p className="font-semibold">Dispute — {dispute.status}</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="bg-black/10 rounded p-2">
                  <p className="text-xs uppercase font-semibold">{m.sender}</p>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
            {dispute.status === "open" && (
              <div className="space-y-2">
                <div className="flex gap-2 items-center text-sm">
                  <label>Send as:</label>
                  <select
                    value={sender}
                    onChange={(e) => setSender(e.target.value as any)}
                    className="bg-white rounded px-2 py-1"
                  >
                    <option value="buyer">buyer</option>
                    <option value="seller">seller</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  className="w-full bg-white rounded px-3 py-2"
                  placeholder="Message"
                />
                <button
                  disabled={busy || !msg.trim()}
                  onClick={() =>
                    run(async () => {
                      await sendMsg({ data: { id: trade.id, password, sender, content: msg } });
                      setMsg("");
                    })
                  }
                  className="px-4 py-2 bg-black text-white rounded"
                >
                  Send
                </button>
              </div>
            )}
          </YellowCard>
        )}

        {trade.status === "completed" && (
          <YellowCard>
            <p className="font-semibold">Trade completed. Funds have been released to the seller.</p>
          </YellowCard>
        )}
        {trade.status === "cancelled" && (
          <YellowCard><p>This trade was cancelled.</p></YellowCard>
        )}

        {err && <p className="text-destructive">{err}</p>}
      </Panel>
    </Layout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel/60 rounded p-3">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className="font-mono">{value}</p>
    </div>
  );
}
