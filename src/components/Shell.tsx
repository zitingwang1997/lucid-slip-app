import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Ambient } from "./Ambient";

export function Shell({
  children,
  showTemple = true,
  intensity = 0.6,
}: {
  children: ReactNode;
  showTemple?: boolean;
  intensity?: number;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <Ambient intensity={intensity} />
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <header className="flex items-center justify-between px-6 pt-6">
          <Link to="/" className="flex items-center gap-2 text-foreground/80">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-primary breathe"
              style={{ boxShadow: "0 0 12px var(--primary)" }}
            />
            <span className="font-serif-display text-sm tracking-[0.35em] uppercase text-foreground/70">
              一签
            </span>
          </Link>
          {showTemple && (
            <Link
              to="/temple"
              className="text-[10px] tracking-[0.4em] uppercase text-foreground/45 hover:text-foreground/80 transition-colors"
            >
              心庙
            </Link>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
