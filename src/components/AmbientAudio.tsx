import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Volume2, VolumeX } from "lucide-react";
import { trackClarityEvent } from "@/lib/clarity";

const AUDIO_PREFERENCE_KEY = "oneslip.audioEnabled";
const TARGET_VOLUME = 0.1;

interface AmbientAudioContextValue {
  enabled: boolean;
  hasChosen: boolean;
  toggleAudio: () => void;
}

const AmbientAudioContext = createContext<AmbientAudioContextValue | null>(null);

function readAudioPreference() {
  try {
    const value = window.localStorage.getItem(AUDIO_PREFERENCE_KEY);
    if (value === "true") return true;
    if (value === "false") return false;
  } catch {
    // Audio remains opt-in when storage is unavailable.
  }
  return null;
}

function saveAudioPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(AUDIO_PREFERENCE_KEY, String(enabled));
  } catch {
    // Playback should still work for the current visit.
  }
}

export function AmbientAudio({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeFrame = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  // Start collapsed during SSR/hydration. First-time visitors expand after the
  // stored preference is checked, while returning visitors avoid a label flash.
  const [hasChosen, setHasChosen] = useState(true);

  const cancelFade = useCallback(() => {
    if (fadeFrame.current != null) {
      cancelAnimationFrame(fadeFrame.current);
      fadeFrame.current = null;
    }
  }, []);

  const fadeTo = useCallback(
    (target: number, duration: number, onComplete?: () => void) => {
      const audio = audioRef.current;
      if (!audio) return;
      cancelFade();

      const from = audio.volume;
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        audio.volume = from + (target - from) * eased;

        if (progress < 1) {
          fadeFrame.current = requestAnimationFrame(tick);
        } else {
          fadeFrame.current = null;
          onComplete?.();
        }
      };

      fadeFrame.current = requestAnimationFrame(tick);
    },
    [cancelFade],
  );

  const startAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    try {
      audio.volume = 0;
      await audio.play();
      fadeTo(TARGET_VOLUME, 2_500);
      return true;
    } catch {
      // Autoplay, network, and decoding failures must never block the ritual.
      return false;
    }
  }, [fadeTo]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    fadeTo(0, 320, () => audio.pause());
  }, [fadeTo]);

  useEffect(() => {
    const preference = readAudioPreference();
    setHasChosen(preference !== null);
    if (preference !== true) return;

    setEnabled(true);
    let disposed = false;

    const removeUnlockListeners = () => {
      document.removeEventListener("pointerdown", unlockWithPointer);
      document.removeEventListener("keydown", unlockWithKeyboard);
    };

    const unlockWithPointer = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest?.("[data-ambient-audio-toggle]")) return;
      removeUnlockListeners();
      void startAudio();
    };

    const unlockWithKeyboard = () => {
      removeUnlockListeners();
      void startAudio();
    };

    void startAudio().then((started) => {
      if (started || disposed) return;
      document.addEventListener("pointerdown", unlockWithPointer, { once: true });
      document.addEventListener("keydown", unlockWithKeyboard, { once: true });
    });

    return () => {
      disposed = true;
      removeUnlockListeners();
    };
  }, [startAudio]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.hidden) {
        cancelFade();
        audio.pause();
      } else if (enabled) {
        void startAudio();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [cancelFade, enabled, startAudio]);

  useEffect(() => cancelFade, [cancelFade]);

  const toggleAudio = () => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    setHasChosen(true);
    saveAudioPreference(nextEnabled);

    if (nextEnabled) {
      trackClarityEvent("music_enabled");
      void startAudio();
    } else {
      trackClarityEvent("music_disabled");
      stopAudio();
    }
  };

  return (
    <AmbientAudioContext.Provider value={{ enabled, hasChosen, toggleAudio }}>
      <audio ref={audioRef} src="/audio/oneslip-ambient.mp3" preload="none" loop />
      {children}
    </AmbientAudioContext.Provider>
  );
}

export function AmbientAudioToggle() {
  const audio = useContext(AmbientAudioContext);
  if (!audio) return null;

  const { enabled, hasChosen, toggleAudio } = audio;
  const showLabel = !hasChosen && !enabled;

  return (
    <button
      type="button"
      data-ambient-audio-toggle
      aria-label={enabled ? "关闭背景音乐" : "开启背景音乐"}
      aria-pressed={enabled}
      title={enabled ? "关闭背景音乐" : "开启背景音乐"}
      onClick={toggleAudio}
      className={`relative z-10 flex h-8 shrink-0 items-center justify-center border bg-[rgba(28,17,11,0.58)] text-foreground/55 shadow-[0_0_18px_rgba(190,116,53,0.06)] backdrop-blur-sm transition-[width,border-color,color,box-shadow] duration-500 after:absolute after:-inset-1.5 after:content-[''] hover:border-primary/40 hover:text-foreground/85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${
        showLabel
          ? "w-[108px] gap-2 rounded-full border-primary/30 px-3"
          : "w-8 rounded-full border-foreground/15"
      } ${enabled ? "border-primary/35 text-primary/80 shadow-[0_0_22px_rgba(190,116,53,0.14)]" : ""}`}
    >
      {showLabel && (
        <span
          aria-hidden="true"
          className="ambient-audio-invite-glow pointer-events-none absolute inset-[-3px] rounded-full border border-primary/25 opacity-0"
        />
      )}
      <span className="relative z-10 flex items-center justify-center">
        {enabled ? (
          <Volume2 size={14} strokeWidth={1.35} />
        ) : (
          <VolumeX size={14} strokeWidth={1.35} />
        )}
      </span>
      {showLabel && (
        <span className="relative z-10 whitespace-nowrap font-serif-sc text-[10px] tracking-[0.18em]">
          开启音乐
        </span>
      )}
    </button>
  );
}
