import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Layout, Panel } from "@/components/Layout";

export const Route = createFileRoute("/check-trade")({
  head: () => ({
    meta: [
      { title: "Check Trade — Fair Trade" },
      { name: "description", content: "Open an existing escrow trade with your Trade ID and password." },
    ],
  }),
  component: CheckTrade,
});

function CheckTrade() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Layout>
      <Panel className="max-w-xl mx-auto">
        <h1 className="text-3xl text-center mb-6">Check Trade</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const u = new URL(window.location.href);
            u.pathname = `/trade/${id.trim()}`;
            u.searchParams.set("pw", password);
            navigate({ to: "/trade/$id", params: { id: id.trim() }, search: { pw: password } });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block font-semibold mb-2">Trade ID:</label>
            <input
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full bg-card text-card-foreground rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-2">Password:</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card text-card-foreground rounded px-3 py-2"
            />
          </div>
          <button className="px-5 py-2 bg-cyan-brand text-black rounded font-semibold">
            Open Trade
          </button>
        </form>
      </Panel>
    </Layout>
  );
}
