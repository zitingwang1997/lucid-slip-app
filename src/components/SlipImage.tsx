import { useEffect, useState, type CSSProperties } from "react";
import type { SelectedSlip } from "@/lib/fortune-store";
import { getSlipImageSources } from "@/lib/slip-image";

type ImageStatus = "loading" | "loaded" | "failed";

interface SlipImageProps {
  slip: SelectedSlip;
  alt: string;
  imgClassName: string;
  errorClassName?: string;
  imgStyle?: CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  readyDelayMs?: number;
  onReady?: () => void;
}

const DECODE_GRACE_MS = 400;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

export function SlipImage({
  slip,
  alt,
  imgClassName,
  errorClassName,
  imgStyle,
  loading = "eager",
  fetchPriority = "auto",
  readyDelayMs = 0,
  onReady,
}: SlipImageProps) {
  const sources = getSlipImageSources(slip);
  const [source, setSource] = useState(sources.primary);
  const [usingFallback, setUsingFallback] = useState(false);
  const [status, setStatus] = useState<ImageStatus>(sources.primary ? "loading" : "failed");

  useEffect(() => {
    setSource(sources.primary);
    setUsingFallback(false);
    setStatus(sources.primary ? "loading" : "failed");
  }, [sources.primary, sources.fallback]);

  const handleLoad = async (image: HTMLImageElement) => {
    const loadedSrc = image.currentSrc;

    // WebKit webviews can leave decode() pending. Give decoding a short grace
    // period, then show the already-loaded image instead of blocking the UI.
    await Promise.race([image.decode().catch(() => undefined), wait(DECODE_GRACE_MS)]);

    if (!image.isConnected || image.currentSrc !== loadedSrc) return;
    setStatus("loaded");

    // React and WeChat's WebView can commit the parent state before the image
    // has painted its first visible frame. Let the image render first, then
    // unlock dependent text and gestures after its short fade-in.
    await nextFrame();
    await nextFrame();
    if (readyDelayMs > 0) await wait(readyDelayMs);
    if (!image.isConnected || image.currentSrc !== loadedSrc) return;
    onReady?.();
  };

  const handleError = () => {
    if (!usingFallback && sources.fallback && sources.fallback !== source) {
      setUsingFallback(true);
      setStatus("loading");
      setSource(sources.fallback);
      return;
    }
    setStatus("failed");
  };

  const retry = () => {
    const retrySource = sources.primary || sources.fallback;
    if (!retrySource) return;
    const separator = retrySource.includes("?") ? "&" : "?";
    setUsingFallback(false);
    setStatus("loading");
    setSource(`${retrySource}${separator}retry=${Date.now()}`);
  };

  return (
    <>
      {source && (
        <img
          src={source}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          draggable={false}
          onLoad={(event) => void handleLoad(event.currentTarget)}
          onError={handleError}
          className={imgClassName}
          style={{
            ...imgStyle,
            opacity: status === "loaded" ? 1 : 0,
            transition: imgStyle?.transition ?? "opacity 500ms ease",
          }}
        />
      )}

      {status === "failed" && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            retry();
          }}
          className={
            errorClassName ??
            "absolute inset-0 z-20 flex items-center justify-center font-serif-sc text-[11px] tracking-[0.2em] text-foreground/55"
          }
        >
          签面未载入 · 重试
        </button>
      )}
    </>
  );
}
