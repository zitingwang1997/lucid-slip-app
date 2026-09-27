import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { InputAmoebaAura } from "@/components/InputAmoebaAura";
import { ParticleSplashIntro } from "@/components/ParticleSplashIntro";
import { Shell } from "@/components/Shell";
import { clearRitualSession, getTodayHistory, setUserQuestion } from "@/lib/fortune-store";
import { trackClarityEvent } from "@/lib/clarity";

function normalizeQuestionForExactMatch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "一签 OneSlip — 一个安静的现代仪式" },
      { name: "description", content: "提一个问题，求一支签，与AI一同安静地解签。" },
      { property: "og:title", content: "一签 OneSlip" },
      { property: "og:description", content: "现代心灵仪式 · 提问 · 求签 · 解签" },
    ],
  }),
  component: QuestionPage,
});

function QuestionPage() {

  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const inputAnchorRef = useRef<HTMLDivElement>(null);

  const resizeQuestionInput = (element: HTMLTextAreaElement) => {
    const maxHeight = 114;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const proceed = () => {
    const text = q.trim();
    if (!text) return;
    trackClarityEvent("question_submitted");

    const today = getTodayHistory();
    const normalized = normalizeQuestionForExactMatch(text);
    const exactMatch = today.find(
      (entry) => normalizeQuestionForExactMatch(entry.question) === normalized,
    );
    if (exactMatch) {
      trackClarityEvent("same_day_redirected");
      navigate({
        to: "/today-guidance",
        search: { id: exactMatch.id, q: text },
      });
      return;
    }

    clearRitualSession();
    setUserQuestion(text);
    navigate({ to: "/draw" });
  };

  return (
    <><ParticleSplashIntro /><Shell intensity={0} overlayHeader>
      <main
        ref={mainRef}
        className="relative z-10 flex h-[calc(100vh-4.5rem)] flex-col justify-between px-10 slow-fade-in"
        style={{ paddingTop: "10vh", paddingBottom: "10vh", animationDuration: "1.8s" }}
      >
        <InputAmoebaAura containerRef={mainRef} anchorRef={inputAnchorRef} />

        {/* 上区 */}
        <div className="relative z-10 w-full text-center">
          <p className="font-serif-display text-[9px] uppercase text-foreground/25" style={{ letterSpacing: "0.65em", marginTop: "2vh" }}>
            A Modern Ritual
          </p>
          <h1
            className="font-serif-sc text-ivory/95"
            style={{
              marginTop: 20,
              fontWeight: 200,
              fontSize: "clamp(22px, 5.5vw, 28px)",
              lineHeight: 1.85,
              letterSpacing: "0.22em",
              paddingLeft: "0.22em",
              textShadow: "0 0 40px oklch(0.75 0.04 80 / 0.12)",
            }}
          >
            此刻，
            <br />
            你最想问什么？
          </h1>
        </div>

        {/* 中区 */}
        <div ref={inputAnchorRef} className="relative flex w-full flex-col items-center text-center">
          <div className="relative z-10 w-[70%]">
            <textarea
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                resizeQuestionInput(e.currentTarget);
              }}
              placeholder="输入你的困惑"
              rows={1}
              className="ritual-question-input relative left-1/2 block w-[122%] -translate-x-1/2 resize-none overflow-y-hidden border-0 bg-transparent text-center font-serif-sc text-[16px] focus:outline-none sm:w-full"
              style={{
                fontSize: "16px",
                letterSpacing: "0.12em",
                lineHeight: 1.65,
                height: "34px",
                minHeight: "34px",
                maxHeight: "114px",
                padding: "4px 0",
                color: "rgba(255, 255, 255, 0.94)",
                WebkitTextFillColor: "rgba(255, 255, 255, 0.94)",
                mixBlendMode: "normal",
                opacity: 1,
              }}
            />
            <div
              aria-hidden
              className="mx-auto mt-2 h-px w-1/2"
              style={{
                background: "linear-gradient(to right, transparent, oklch(0.75 0.04 80 / 0.18), transparent)",
              }}
            />
            <div aria-hidden className="mt-6 h-7" />
          </div>
        </div>

        {/* 下区 */}
        <div className="relative z-10 flex justify-center" style={{ marginBottom: "8vh" }}>
          <button
            onClick={proceed}
            disabled={!q.trim()}
            className="rounded-full border border-foreground/12 bg-transparent px-12 py-2.5 font-serif-sc text-[13px] text-ivory/90 transition-all duration-500 hover:border-foreground/28 hover:text-ivory disabled:opacity-60"
            style={{
              letterSpacing: "0.48em",
              paddingRight: "calc(3rem - 0.48em)",
              boxShadow: "0 0 24px oklch(0.75 0.04 80 / 0.04)",
            }}
          >
            求一支签
          </button>
        </div>
      </main>
    </Shell></>
  );
}
