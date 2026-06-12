import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  getInterpretCacheV2,
  getSelectedSlip,
  getUserQuestion,
  setInterpretCacheV2,
  setInterpretation,
  slipCacheId,
  type SelectedSlip,
} from "@/lib/fortune-store";
import { interpretSlip } from "@/lib/dify.functions";

export const Route = createFileRoute("/poem")({
  head: () => ({ meta: [{ title: "签诗 · 一签" }] }),
  component: PoemPage,
});

function buildQianData(slip: SelectedSlip) {
  return {
    id: slip.id,
    number: slip.number,
    title: slip.title,
    poem: slip.poem,
    allusion: slip.allusion,
    meaning_seed: (slip as any).meaning_seed ?? slip.keywords,
  };
}

type InterpretStatus = "idle" | "loading" | "success" | "error";

function PoemPage() {
  const navigate = useNavigate();
  const interpretSlipFn = useServerFn(interpretSlip);
  const [slip, setSlip] = useState<SelectedSlip | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [interpretStatus, setInterpretStatus] = useState<InterpretStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const runInterpret = useCallback(
    async (s: SelectedSlip, q: string) => {
      console.log("[PRELOAD] runInterpret called");
      console.log("[PRELOAD] slip:", s);
      console.log("[PRELOAD] question:", q);

      if (inflight.current) {
        console.warn("[PRELOAD] already inflight, skip");
        return;
      }

      inflight.current = true;
      setInterpretStatus("loading");
      setError(null);

      try {
        const payload = {
          user_question: q,
          qian_data: JSON.stringify(buildQianData(s)),
        };

        console.log("[PRELOAD] payload to Workflow B:", payload);

        const res = await interpretSlipFn({ data: payload });

        console.log("[PRELOAD] raw Workflow B response:", res);

        const hasContent = res?.xiang_content || res?.yi_content || res?.xing_content;

        console.log("[PRELOAD] hasContent:", hasContent);

        if (!hasContent) {
          throw new Error("解签结果为空，请重试");
        }

        setInterpretation(res);

        const cachePayload = {
          slipId: slipCacheId(s),
          user_question: q,
          interpret: res,
          createdAt: Date.now(),
        };

        console.log("[PRELOAD] saving interpret cache:", cachePayload);

        setInterpretCacheV2(cachePayload);

        console.log("[PRELOAD] saved cache now:", getInterpretCacheV2());

        setInterpretStatus("success");
      } catch (e: any) {
        console.error("[Workflow B] failed:", e);
        setError(e?.message ?? "解签失败，请稍后再试");
        setInterpretStatus("error");
      } finally {
        inflight.current = false;
      }
    },
    [interpretSlipFn],
  );

  useEffect(() => {
    console.log("[POEM] mounted");

    const allKeys = Object.keys(localStorage).filter((k) => k.includes("oneslip"));
    console.log("[POEM] oneslip localStorage keys:", allKeys);
    allKeys.forEach((k) => {
      console.log(`[POEM] ${k}:`, localStorage.getItem(k));
    });

    const q = getUserQuestion();
    console.log("[POEM] user question:", q);

    if (!q || !q.trim()) {
      console.warn("[POEM] missing user question, redirect to /");
      navigate({ to: "/" });
      return;
    }

    const s = getSelectedSlip();
    console.log("[POEM] selected slip:", s);
    console.log("[POEM] slip cache id:", s ? slipCacheId(s) : null);

    if (!s) {
      console.warn("[POEM] missing selected slip, redirect to /draw");
      navigate({ to: "/draw" });
      return;
    }

    setSlip(s);

    const t = window.setTimeout(() => setRevealed(true), 600);

    const cached = getInterpretCacheV2();
    console.log("[POEM] interpret cache:", cached);

    if (
      cached &&
      cached.slipId === slipCacheId(s) &&
      cached.user_question === q &&
      (cached.interpret?.xiang_content || cached.interpret?.yi_content || cached.interpret?.xing_content)
    ) {
      console.log("[POEM] cache hit, skip Workflow B");
      setInterpretation(cached.interpret);
      setInterpretStatus("success");
    } else {
      console.log("[POEM] cache miss, start Workflow B");
      void runInterpret(s, q);
    }

    return () => window.clearTimeout(t);
  }, [navigate, runInterpret]);

  if (!slip) return null;

  const onPrimary = () => {
    if (interpretStatus === "success") {
      navigate({ to: "/interpret" });
    } else if (interpretStatus === "error") {
      const q = getUserQuestion();
      if (slip && q) void runInterpret(slip, q);
    }
  };

  const onRestart = () => {
    navigate({ to: "/" });
  };

  const buttonLabel =
    interpretStatus === "loading" ? "解 签 生 成 中…" : interpretStatus === "error" ? "重 新 解 签" : "解 签";
  const buttonDisabled = interpretStatus === "loading" || interpretStatus === "idle";

  const poemParts =
    (slip.poem ?? "")
      .match(/[^，。！？；]+[，。！？；]?/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [];

  const normalizePoemColumn = (text: string) => {
    if (!text) return "";
    return /[，。！？；]$/.test(text) ? text : `${text}。`;
  };

  const rightColumn = normalizePoemColumn(poemParts.slice(0, 2).join(""));
  const leftColumn = normalizePoemColumn(poemParts.slice(2, 4).join(""));

  const realm = String(slip.realm ?? "").trim();
  const realmLevelMatch = realm.match(/(上吉|中吉|下吉|大吉|小吉|平|凶)/);
  const realmLevel = realmLevelMatch?.[1] ?? "";
  const realmName = realmLevel
    ? realm
        .replace(realmLevel, "")
        .replace(/[·\-\s]+$/, "")
        .trim() || realm
    : realm;

  return (
    <Shell intensity={0.5}>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-4">
        <div
          className="slow-fade-in w-full"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 1.4s ease, transform 1.4s ease",
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          {slip.image_url ? (
            <div
              className="relative mx-auto w-[88%]"
              style={{
                aspectRatio: "848 / 1489",
                maxWidth: 460,
                containerType: "inline-size",
                filter: "drop-shadow(0 30px 60px oklch(0 0 0 / 0.6)) drop-shadow(0 0 50px oklch(0.74 0.13 55 / 0.2))",
              }}
            >
              <img
                src={slip.image_url}
                alt={slip.title ?? "签"}
                className="absolute inset-0 block h-full w-full select-none"
                draggable={false}
                style={{ objectFit: "contain" }}
              />

              {/* Top-left: Chinese number */}
              <div
                className="pointer-events-none absolute font-serif-sc text-[rgba(55,38,24,0.82)]"
                style={{
                  left: "8%",
                  top: "3.8%",
                  fontSize: "3.8cqi",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  lineHeight: 1.15,
                }}
              >
                {slip.number}
              </div>

              {/* Top-right: poem title */}
              <div
                className="pointer-events-none absolute flex flex-col items-center font-serif-sc text-[rgba(55,38,24,0.82)]"
                style={{ right: "8%", top: "3.8%", lineHeight: 1.15, letterSpacing: "0.08em" }}
              >
                <span style={{ fontSize: "3.8cqi", fontWeight: 500 }}>{slip.title}</span>
              </div>

              {/* Right vertical column: lines 1-2 (rightmost line first) */}
              <div
                className="pointer-events-none absolute flex flex-row-reverse"
                style={{ right: "7%", top: "20%", gap: "clamp(4px, 1.6cqi, 14px)" }}
              >
                <span
                  className="poem-line-reveal font-serif-sc text-[rgba(55,38,24,0.86)]"
                  style={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    letterSpacing: "0.12em",
                    fontSize: "3.1cqi",
                    lineHeight: 1.25,
                    animationDelay: "1.2s",
                  }}
                >
                  {rightColumn}
                </span>
              </div>

              {/* Left vertical column: lines 3-4 (rightmost line first) */}
              <div
                className="pointer-events-none absolute flex flex-row-reverse"
                style={{ left: "7%", top: "20%", gap: "clamp(4px, 1.6cqi, 14px)" }}
              >
                <span
                  className="poem-line-reveal font-serif-sc text-[rgba(55,38,24,0.86)]"
                  style={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    letterSpacing: "0.12em",
                    fontSize: "3.1cqi",
                    lineHeight: 1.25,
                    animationDelay: "3.2s",
                  }}
                >
                  {leftColumn}
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex aspect-[848/1489] w-full max-w-[360px] items-center justify-center rounded-[28px] border border-border/40 font-serif-sc text-sm text-foreground/45">
              签面缺失
            </div>
          )}
        </div>

        {revealed && (
          <div className="mt-10 flex w-full max-w-[340px] flex-col items-center gap-3 slow-fade-in">
            <button
              onClick={onPrimary}
              disabled={buttonDisabled}
              className="w-full rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent py-3.5 text-center font-serif-sc text-sm tracking-[0.5em] text-ivory transition-all hover:border-primary/70 disabled:opacity-60"
              style={{ boxShadow: "0 0 28px oklch(0.74 0.13 55 / 0.15)" }}
            >
              {buttonLabel}
            </button>
            {interpretStatus === "error" && (
              <>
                {error && <p className="font-serif-sc text-[11px] tracking-[0.2em] text-destructive/80">{error}</p>}
                <button
                  onClick={onRestart}
                  className="mt-1 rounded-full border border-foreground/20 px-6 py-2 font-serif-sc text-[11px] tracking-[0.3em] text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
                >
                  重 启 仪 式
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </Shell>
  );
}
