import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  watchdogMs?: number;
  onReady?: () => void;
  onRetry?: () => void;
  onFailure?: () => void;
}

const DECODE_GRACE_MS = 400;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function withCacheBust(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}retry=${Date.now()}`;
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
  watchdogMs = 0,
  onReady,
  onRetry,
  onFailure,
}: SlipImageProps) {
  const sources = getSlipImageSources(slip);
  const [source, setSource] = useState(sources.primary);
  const [usingFallback, setUsingFallback] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<ImageStatus>(sources.primary ? "loading" : "failed");
  const imageRef = useRef<HTMLImageElement | null>(null);
  const readyRef = useRef(false);
  const failureReportedRef = useRef(false);

  useEffect(() => {
    setSource(sources.primary);
    setUsingFallback(false);
    setAttempt(0);
    setStatus(sources.primary ? "loading" : "failed");
    readyRef.current = false;
    failureReportedRef.current = false;
  }, [sources.primary, sources.fallback]);

  const handleLoad = async (image: HTMLImageElement) => {
    if (readyRef.current || image.naturalWidth <= 0) return;
    readyRef.current = true;

    // WebKit webviews can leave decode() pending. Give decoding a short grace
    // period, then show the already-loaded image instead of blocking the UI.
    await Promise.race([image.decode().catch(() => undefined), wait(DECODE_GRACE_MS)]);

    if (!image.isConnected || imageRef.current !== image || image.naturalWidth <= 0) {
      readyRef.current = false;
      return;
    }
    setStatus("loaded");

    // React and WeChat's WebView can commit the parent state before the image
    // has painted its first visible frame. Let the image render first, then
    // unlock dependent text and gestures after its short fade-in.
    await nextFrame();
    await nextFrame();
    if (readyDelayMs > 0) await wait(readyDelayMs);
    if (!image.isConnected || imageRef.current !== image) return;
    onReady?.();
  };

  const reportFailure = () => {
    setStatus("failed");
    if (failureReportedRef.current) return;
    failureReportedRef.current = true;
    onFailure?.();
  };

  const retryPrimary = (automatic: boolean) => {
    if (!sources.primary) {
      reportFailure();
      return;
    }
    readyRef.current = false;
    failureReportedRef.current = false;
    setUsingFallback(false);
    setAttempt(automatic ? 1 : 0);
    setStatus("loading");
    setSource(withCacheBust(sources.primary));
    onRetry?.();
  };

  const handleError = () => {
    if (watchdogMs > 0) {
      if (attempt === 0) retryPrimary(true);
      else reportFailure();
      return;
    }
    if (!usingFallback && sources.fallback && sources.fallback !== source) {
      setUsingFallback(true);
      setStatus("loading");
      setSource(sources.fallback);
      return;
    }
    reportFailure();
  };

  const retry = () => {
    retryPrimary(false);
  };

  useEffect(() => {
    const image = imageRef.current;
    if (!image || status !== "loading") return;

    // Cached images can finish before some Android/WeChat WebViews deliver
    // React's onLoad callback. Inspect the element directly as a second path.
    if (image.complete && image.naturalWidth > 0) {
      void handleLoad(image);
      return;
    }

    if (watchdogMs <= 0) return;
    const timeout = window.setTimeout(() => {
      const currentImage = imageRef.current;
      if (currentImage?.complete && currentImage.naturalWidth > 0) {
        void handleLoad(currentImage);
        return;
      }
      if (attempt === 0) retryPrimary(true);
      else reportFailure();
    }, watchdogMs);

    return () => window.clearTimeout(timeout);
    // Callback props intentionally do not restart an in-flight image watchdog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, status, attempt, watchdogMs]);

  return (
    <>
      {source && (
        <img
          ref={imageRef}
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
