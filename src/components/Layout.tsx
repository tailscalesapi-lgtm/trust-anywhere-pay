import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function Layout({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-2xl font-semibold">
            <span className="text-cyan-brand">Fair</span>{" "}
            <span className="text-lime-brand">Trade</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/terms">Terms</NavLink>
          <NavLink to="/faq">FAQ</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/check-trade"
            className="px-4 py-2 rounded bg-lime-brand text-black font-medium hover:brightness-95"
          >
            Check Trade
          </Link>
          <Link
            to="/new-trade"
            className="px-4 py-2 rounded bg-cyan-brand text-black font-medium hover:brightness-95"
          >
            Start Trade
          </Link>
        </div>
      </header>

      {banner !== undefined ? (
        <div className="bg-banner text-banner-foreground text-center font-semibold py-3 mx-4 rounded">
          {banner}
        </div>
      ) : null}

      <main className="flex-1 px-4 py-4">{children}</main>

      <footer className="px-6 py-6 flex items-center gap-4 text-sm">
        <span title="Bitcoin" className="w-9 h-9 rounded-full bg-[#f7931a] flex items-center justify-center font-bold text-white">
          ₿
        </span>
        <span className="ml-auto text-lime-brand font-semibold">community escrow</span>
      </footer>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="hover:text-cyan-brand transition-colors"
      activeProps={{ className: "text-cyan-brand font-medium" }}
    >
      {children}
    </Link>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-panel rounded-lg p-8 ${className}`}>{children}</div>
  );
}

export function YellowCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card text-card-foreground rounded px-6 py-4 ${className}`}>{children}</div>
  );
}
