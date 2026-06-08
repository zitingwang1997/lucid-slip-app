import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { InputAmoebaAura } from "@/components/InputAmoebaAura";
import { Shell } from "@/components/Shell";
import { clearRitualSession, setUserQuestion } from "@/lib/fortune-store";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "一签 OneSlip — 一个安静的现代仪式" },
      { name: "description", content: "提一个问题,求一支签,与AI一同安静地解签。" },
      { property: "og:title", content: "一签 OneSlip" },
      { property: "og:description", content: "现代心灵仪式 · 提问 · 求签 · 解签" },
    ],
  }),
  component: QuestionPage,
});

function QuestionPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mainRef = useRef<HTMLElement>(null);
  const inputAnchorRef = useRef<HTMLDivElement>(null);

  const startVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = "zh-CN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQ((prev) => (prev ? prev + " " + transcript : transcript));
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const proceed = () => {
    const text = q.trim();
    if (!text) return;
    // Dify Workflow A is the single source of truth for same-day gating.
    // Frontend just hands the question off to /draw.
    clearRitualSession();
    setUserQuestion(text);
    navigate({ to: "/draw" });
  };


  return (
    <Shell intensity={0} overlayHeader>
      <main
        ref={mainRef}
        className="relative z-10 flex h-[calc(100vh-4.5rem)] flex-col justify-between px-10 slow-fade-in"
        style={{ paddingTop: "10vh", paddingBottom: "10vh", animationDuration: "1.8s" }}
      >
        <InputAmoebaAura containerRef={mainRef} anchorRef={inputAnchorRef} />

        {/* 上区 */}
        <div className="relative z-10 w-full text-center">
          <p className="font-serif-display text-[9px] uppercase text-foreground/25" style={{ letterSpacing: "0.65em" }}>
            A Modern Ritual
          </p>
          <h1
            className="font-serif-sc text-ivory/95"
            style={{
              marginTop: 16,
              fontWeight: 200,
              fontSize: "clamp(22px, 5.5vw, 28px)",
              lineHeight: 1.85,
              letterSpacing: "0.22em",
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
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="输入你的困惑..."
              className="ritual-question-input w-full border-0 bg-transparent text-center font-serif-sc text-[14px] focus:outline-none"
              style={{
                letterSpacing: "0.12em",
                padding: "8px 0",
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
            <div className="mt-6 flex flex-col items-center gap-1.5">
              <button
                onClick={listening ? stopVoice : startVoice}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-foreground/10 transition-colors hover:border-foreground/25"
                style={{
                  boxShadow: listening ? "0 0 14px oklch(0.75 0.04 80 / 0.15)" : undefined,
                  animation: listening ? "breathe 2s ease-in-out infinite" : undefined,
                }}
                aria-label={listening ? "停止语音输入" : "语音输入"}
              >
                <Mic size={13} className={listening ? "text-foreground/70" : "text-foreground/30"} strokeWidth={1.25} />
              </button>
              {listening && (
                <span className="font-serif-sc text-[9px] text-foreground/40" style={{ letterSpacing: "0.25em" }}>
                  聆听中…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 下区 */}
        <div className="relative z-10 flex justify-center" style={{ marginBottom: "8vh" }}>
          <button
            onClick={proceed}
            disabled={checking || !q.trim()}
            className="rounded-full border border-foreground/12 bg-transparent px-12 py-2.5 font-serif-sc text-[13px] text-ivory/90 transition-all duration-500 hover:border-foreground/28 hover:text-ivory disabled:opacity-60"
            style={{
              letterSpacing: "0.48em",
              paddingRight: "calc(3rem - 0.48em)",
              boxShadow: "0 0 24px oklch(0.75 0.04 80 / 0.04)",
            }}
          >
            {checking ? "静观片刻…" : "求一支签"}
          </button>
        </div>
      </main>
    </Shell>
  );
}
