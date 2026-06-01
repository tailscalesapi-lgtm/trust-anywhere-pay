import { createFileRoute } from "@tanstack/react-router";
import { Layout, YellowCard } from "@/components/Layout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Fair Trade" },
      { name: "description", content: "Binding terms for every escrow trade on Fair Trade." },
    ],
  }),
  component: Terms,
});

const terms = [
  "The finalization timer starts as soon as the buyer pays.",
  "The buyer can choose to release funds at anytime. If they don't, the seller will have to wait until the finalization time is over.",
  "The buyer has until the finalization time is over to dispute. If the buyer doesn't dispute before the finalization timer is over, the funds are transferred to the seller.",
  "If a seller doesn't deliver the goods in the designated time the buyer can choose to extend the time by disputing or be refunded by disputing.",
  "The trade amount, agreement and finalization time are binding and can not be changed.",
  "In the event of dispute the moderator's decision is based on ONLY the trade agreement. Extra details or side deals not included in the trade agreement will not effect the moderator's decision unless both parties agree to them.",
  "Failing to fill out the trade agreement correctly might cause loss of funds. We are not responsible if you don't fill out the trade agreement correctly.",
  "There are no fees except a 4% withdraw fee.",
  "Deposits can be made in Bitcoin. Withdraws are Bitcoin only.",
  "Before starting a trade make sure there is a way for the seller to prove he provided the goods. If there is not you risk losing your money.",
  "Dispute decisions can either be full or partial refunds.",
];

function Terms() {
  return (
    <Layout banner={<>Everything below is binding and can't be changed!</>}>
      <YellowCard className="relative">
        <h1 className="absolute top-4 right-6 text-4xl">Terms</h1>
        <ul className="list-disc pl-6 space-y-3 max-w-5xl">
          {terms.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <a
          href="/new-trade"
          className="inline-block mt-6 px-5 py-2 bg-black text-white rounded font-medium"
        >
          Accept
        </a>
      </YellowCard>
    </Layout>
  );
}
