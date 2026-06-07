import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  getSelectedSlip,
  getUserQuestion,
  setInterpretation,
  type SelectedSlip,
} from "@/lib/fortune-store";
import { interpretSlip } from "@/lib/dify.functions";

export const Route = createFileRoute("/poem")({
  head: () => ({ meta: [{ title: "签诗 · 一签" }] }),
  component: PoemPage,
});

function PoemPage() {
  const navigate = useNavigate();
  const interpretSlipFn = useServerFn(interpretSlip);
  const [slip, setSlip] = useState<SelectedSlip | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSelectedSlip();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setSlip(s);
    const t = window.setTimeout(() => setRevealed(true), 600);
    return () => window.clearTimeout(t);
  }, [navigate]);

  if (!slip) return null;

  const onInterpret = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        user_question: getUserQuestion(),
        qian_data: JSON.stringify(slip),
      };
      console.log("[Workflow B] request payload:", payload);
      const res = await interpretSlipFn({ data: payload });
      console.log("[Workflow B] response:", res);
      setInterpretation(res ?? {});
      navigate({ to: "/interpret" });
    } catch (e: any) {
      console.error("[Workflow B] failed:", e);
      setLoading(false);
      setError(e?.message ?? "解签失败，请稍后再试");
    }
  };

  return (
    <Shell intensity={0.5}>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12 pt-4">
        <div
          className="slow-fade-in w-full"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 1.4s ease, transform 1.4s ease",
            maxWidth: 520,
          }}
        >
          {slip.image_url ? (
            <img
              src={slip.image_url}
              alt="签"
              className="block select-none"
              draggable={false}
              style={{
                width: "100%",
                maxWidth: 520,
                height: "auto",
                objectFit: "contain",
                filter:
                  "drop-shadow(0 30px 60px oklch(0 0 0 / 0.6)) drop-shadow(0 0 50px oklch(0.74 0.13 55 / 0.2))",
              }}
            />
          ) : (
            <div className="mx-auto flex aspect-[2/3] w-full max-w-[360px] items-center justify-center rounded-[28px] border border-border/40 font-serif-sc text-sm text-foreground/45">
              签面缺失
            </div>
          )}
        </div>

        {revealed && (
          <div className="mt-10 flex w-full max-w-[340px] flex-col items-center gap-3 slow-fade-in">
            <button
              onClick={onInterpret}
              disabled={loading}
              className="w-full rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent py-3.5 text-center font-serif-sc text-sm tracking-[0.5em] text-ivory transition-all hover:border-primary/70 disabled:opacity-60"
              style={{ boxShadow: "0 0 28px oklch(0.74 0.13 55 / 0.15)" }}
            >
              {loading ? "解 签 中…" : "解 签"}
            </button>
            {error && (
              <p className="font-serif-sc text-[11px] tracking-[0.2em] text-destructive/80">
                {error}
              </p>
            )}
          </div>
        )}
      </main>
    </Shell>
  );
}
