import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Layout, Panel, YellowCard } from "@/components/Layout";
import { createTrade, listAssets } from "@/lib/trades.functions";

export const Route = createFileRoute("/new-trade")({
  head: () => ({
    meta: [
      { title: "Start a New Trade — Fair Trade" },
      { name: "description", content: "Create a new escrow trade and receive a Trade ID + password to share with the other party." },
    ],
  }),
  component: NewTrade,
});

function NewTrade() {
  const navigate = useNavigate();
  const create = useServerFn(createTrade);
  const fetchAssets = useServerFn(listAssets);
  const [assets, setAssets] = useState<Array<{ symbol: string; name: string }>>([]);
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [coin, setCoin] = useState("BTC");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [agreement, setAgreement] = useState("");
  const [hours, setHours] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; password: string } | null>(null);

  useEffect(() => {
    fetchAssets().then((a) => {
      setAssets(a);
      if (a.length && !a.find((x) => x.symbol === coin)) setCoin(a[0].symbol);
    }).catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await create({
        data: {
          role,
          payment_method: coin,
          name: name.trim(),
          amount: Number(amount),
          agreement: agreement.trim(),
          finalization_hours: Number(hours),
        },
      });
      setResult(r);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create trade");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/trade/${result.id}`;
    return (
      <Layout banner={<>Save these credentials — they are the only way to access this trade!</>}>
        <YellowCard className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Trade Created</h1>
          <Field label="Trade ID" value={result.id} />
          <Field label="Password" value={result.password} />
          <Field label="Link" value={link} />
          <button
            onClick={() => navigate({ to: "/trade/$id", params: { id: result.id } })}
            className="px-5 py-2 bg-black text-white rounded font-medium"
          >
            Open Trade
          </button>
        </YellowCard>
      </Layout>
    );
  }

  return (
    <Layout banner={<>Everything below is binding and can't be changed!</>}>
      <YellowCard className="mb-4">
        <h2 className="text-2xl mb-2 text-right">Important!</h2>
        <p className="mb-2">The trade agreement needs to contain all these details:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>*What the seller is going to provide?</li>
          <li>*How the seller is going to provide it?</li>
          <li>*How the seller can prove he provided it?</li>
          <li>What is the buyer's and seller's alias?</li>
        </ul>
        <p className="mt-2">If any of the non-optional questions can't be answered you shouldn't use our service.</p>
      </YellowCard>

      <Panel>
        <h1 className="text-3xl text-center mb-6">New Trade</h1>
        <form onSubmit={onSubmit} className="space-y-5 max-w-2xl mx-auto">
          <div>
            <label className="block font-semibold mb-2">You Are The:</label>
            <RoleOption value="buyer" current={role} onChange={setRole}>
              <strong>Buyer</strong> (buying the goods)
            </RoleOption>
            <RoleOption value="seller" current={role} onChange={setRole}>
              <strong>Seller</strong> (selling the goods)
            </RoleOption>
          </div>

          <Labeled label="Payment Method:">
            <select
              value={coin}
              onChange={(e) => setCoin(e.target.value)}
              className="bg-card text-card-foreground rounded px-3 py-2"
            >
              {assets.length === 0 && <option value="BTC">BTC</option>}
              {assets.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} — {a.name}
                </option>
              ))}
            </select>
          </Labeled>

          <Labeled label="Trade Name:">
            <input
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Short description of the trade"
              className="w-full bg-card text-card-foreground rounded px-3 py-2 placeholder:text-card-foreground/60"
            />
          </Labeled>

          <Labeled label={`Trade Amount (${coin}):`}>
            <input
              type="number"
              step="0.00000001"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter transaction amount"
              className="w-full bg-card text-card-foreground rounded px-3 py-2 placeholder:text-card-foreground/60"
            />
          </Labeled>

          <Labeled label="Trade Agreement:">
            <textarea
              required
              minLength={10}
              maxLength={5000}
              value={agreement}
              onChange={(e) => setAgreement(e.target.value)}
              rows={6}
              placeholder="Exactly what the seller needs to provide and how the seller will provide it. Optionally leave the username of the other party"
              className="w-full bg-card text-card-foreground rounded px-3 py-2 placeholder:text-card-foreground/60"
            />
          </Labeled>

          <Labeled label="Time For Seller To Deliver Goods (finalization time):">
            <select
              required
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="bg-card text-card-foreground rounded px-3 py-2"
            >
              <option value="">Choose</option>
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="24">24 hours (1 day)</option>
              <option value="72">72 hours (3 days)</option>
              <option value="168">168 hours (1 week)</option>
              <option value="336">336 hours (2 weeks)</option>
            </select>
          </Labeled>

          {error && <p className="text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-cyan-brand text-black rounded font-semibold disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Start Trade"}
          </button>
        </form>
      </Panel>
    </Layout>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-semibold mb-2">{label}</label>
      {children}
    </div>
  );
}

function RoleOption({
  value,
  current,
  onChange,
  children,
}: {
  value: "buyer" | "seller";
  current: string;
  onChange: (v: "buyer" | "seller") => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 bg-card text-card-foreground rounded px-3 py-2 mb-2 cursor-pointer w-fit min-w-72">
      <input
        type="radio"
        checked={current === value}
        onChange={() => onChange(value)}
      />
      <span>{children}</span>
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold">{label}</div>
      <code className="block bg-black/10 rounded px-3 py-2 break-all">{value}</code>
    </div>
  );
}
