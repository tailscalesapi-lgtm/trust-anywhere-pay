import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, Panel, YellowCard } from "@/components/Layout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fair Trade — Anonymous Crypto Escrow" },
      { name: "description", content: "Safe peer-to-peer crypto escrow for your community. We make every trade fair." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <Layout banner={<>We now accept <strong>Bitcoin</strong> payments!</>}>
      <Panel className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold">
            Welcome to <span className="text-cyan-brand">Fair</span>{" "}
            <span className="text-lime-brand">Trade</span> — we make every trade fair
          </h1>
          <p className="text-lime-brand text-lg">anonymous crypto escrow service</p>
        </div>

        <h2 className="text-3xl text-center text-lime-brand">How it Works</h2>

        <div className="space-y-12">
          <YellowCard>
            <p className="text-center">
              The buyer or seller creates a new trade. They then receive a password that allows them
              to track the trade and a link to share with the other party.
            </p>
          </YellowCard>
          <YellowCard>
            <p className="text-center">
              The buyer deposits the amount decided upon in the trade details. Upon completion of
              the deposit, the "Trade ID" becomes searchable for the other party.
            </p>
          </YellowCard>
          <YellowCard>
            <p className="text-center">
              Once the buyer has successfully deposited the funds, the seller will be prompted to
              provide the specified product or service. The buyer is able to finalize the trade
              (upon successful receival) or cancel the trade (if abandoned by the seller). Each
              action can be performed by the buyer entering their secret password.
            </p>
          </YellowCard>
          <YellowCard>
            <p className="text-center">
              If the buyer forgets to log in, the seller automatically receives the funds after the
              finalization timer expires.
            </p>
          </YellowCard>
          <YellowCard>
            <p className="text-center">
              If the seller didn't provide what was agreed, the buyer can open a dispute. A
              conversation between the buyer, seller and moderator is opened to clarify the
              situation.
            </p>
          </YellowCard>
        </div>

        <div className="text-center pt-4">
          <Link
            to="/new-trade"
            className="inline-block px-6 py-3 rounded bg-banner text-banner-foreground font-medium hover:brightness-95"
          >
            Start Trade
          </Link>
        </div>
      </Panel>
    </Layout>
  );
}
