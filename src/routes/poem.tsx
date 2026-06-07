import { createFileRoute, useNavigate, useServerFn } from "@tanstack/react-router";
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
      const res = await interpretSlipFn({
        data: {
          user_question: getUserQuestion(),
          qian_data: slip,
        },
      });
      setInterpretation(res?.result ?? {});
      navigate({ to: "/interpret" });
    } catch (e: any) {
      setLoading(false);
      setError(e?.message ?? "解签失败，请稍后再试");
    }
  };

  return (
    <Shell intensity={0.5}>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12 pt-4">
        <div
          className="relative w-full max-w-[360px] overflow-hidden rounded-[28px] border border-border/40 slow-fade-in"
          style={{
            boxShadow:
              "0 30px 80px -20px oklch(0 0 0 / 0.6), 0 0 60px oklch(0.74 0.13 55 / 0.18), inset 0 1px 0 oklch(1 0 0 / 0.05)",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 1.4s ease, transform 1.4s ease",
          }}
        >
          {slip.image_url ? (
            <img
              src={slip.image_url as string}
              alt="签"
              className="block h-auto w-full select-none"
              draggable={false}
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center font-serif-sc text-sm text-foreground/45">
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
