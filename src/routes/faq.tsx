import { createFileRoute } from "@tanstack/react-router";
import { Layout, YellowCard } from "@/components/Layout";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Fair Trade" },
      { name: "description", content: "Frequently asked questions about the Fair Trade crypto escrow service." },
    ],
  }),
  component: FAQ,
});

const faqs = [
  {
    q: "What is Fair Trade?",
    a: "Fair Trade is an anonymous crypto escrow service. The buyer deposits funds, the seller delivers the agreed goods or service, then the funds are released.",
  },
  {
    q: "Do I need an account?",
    a: "No. Each trade is identified by a Trade ID and a secret password that you receive when the trade is created. Save them — they are the only way to access the trade.",
  },
  {
    q: "Which cryptocurrencies are supported?",
    a: "Deposits and withdrawals use Bitcoin (BTC).",
  },
  {
    q: "What if the seller never delivers?",
    a: "Before the finalization timer expires you can open a dispute. A moderator joins the chat and decides based on the trade agreement.",
  },
  {
    q: "What if I forget to release the funds?",
    a: "When the finalization timer runs out, the funds are automatically released to the seller.",
  },
  {
    q: "Are there any fees?",
    a: "There are no fees except a 4% withdrawal fee.",
  },
];

function FAQ() {
  return (
    <Layout banner={<>Frequently asked questions</>}>
      <YellowCard>
        <h1 className="text-3xl mb-4">FAQ</h1>
        <div className="space-y-5">
          {faqs.map((f, i) => (
            <div key={i}>
              <p className="font-semibold">{f.q}</p>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </YellowCard>
    </Layout>
  );
}
