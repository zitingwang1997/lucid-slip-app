import type { SelectedSlip } from "@/lib/fortune-store";
import jiJingxinUrl from "@/assets/qian-images/ji-jingxin.webp";
import pingWukongUrl from "@/assets/qian-images/ping-wukong.webp";
import shangjiMingxinAUrl from "@/assets/qian-images/shangji-mingxin-a.webp";
import shangjiMingxinBUrl from "@/assets/qian-images/shangji-mingxin-b.webp";
import xiaShihuaiAUrl from "@/assets/qian-images/xia-shihuai-a.webp";
import xiaShihuaiBUrl from "@/assets/qian-images/xia-shihuai-b.webp";
import zhongpingPojuUrl from "@/assets/qian-images/zhongping-poju.webp";

export const SLIP_IMAGE_URLS = [
  shangjiMingxinAUrl,
  shangjiMingxinBUrl,
  jiJingxinUrl,
  zhongpingPojuUrl,
  xiaShihuaiAUrl,
  xiaShihuaiBUrl,
  pingWukongUrl,
] as const;

const LOCAL_IMAGE_BY_QIAN_NUMBER: Record<number, string> = {
  1: shangjiMingxinAUrl,
  2: shangjiMingxinBUrl,
  3: shangjiMingxinAUrl,
  4: shangjiMingxinBUrl,
  5: shangjiMingxinAUrl,
  6: shangjiMingxinBUrl,
  7: jiJingxinUrl,
  8: jiJingxinUrl,
  9: jiJingxinUrl,
  10: jiJingxinUrl,
  11: jiJingxinUrl,
  12: jiJingxinUrl,
  13: zhongpingPojuUrl,
  14: zhongpingPojuUrl,
  15: zhongpingPojuUrl,
  16: zhongpingPojuUrl,
  17: zhongpingPojuUrl,
  18: zhongpingPojuUrl,
  19: xiaShihuaiAUrl,
  20: xiaShihuaiBUrl,
  21: xiaShihuaiBUrl,
  22: xiaShihuaiAUrl,
  23: xiaShihuaiAUrl,
  24: xiaShihuaiBUrl,
  25: pingWukongUrl,
  26: pingWukongUrl,
  27: pingWukongUrl,
  28: pingWukongUrl,
  29: pingWukongUrl,
  30: pingWukongUrl,
  31: shangjiMingxinAUrl,
  32: shangjiMingxinAUrl,
  33: shangjiMingxinBUrl,
};

const preloadCache = new Map<string, HTMLImageElement>();

/** Start downloading all seven small sign faces during the drawing ritual. */
export function preloadSlipImages() {
  if (typeof window === "undefined") return;

  for (const url of SLIP_IMAGE_URLS) {
    if (preloadCache.has(url)) continue;
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    preloadCache.set(url, image);
  }
}

function getQianNumber(slip: SelectedSlip): number | null {
  const imageMatch = slip.image_url?.match(/qian_(\d+)\.(?:png|webp)(?:$|[?#])/i);
  if (imageMatch) return Number(imageMatch[1]);

  const id = Number(slip.id);
  return Number.isInteger(id) && id >= 1 && id <= 33 ? id : null;
}

export interface SlipImageSources {
  primary: string;
  fallback?: string;
  isLocal: boolean;
}

/**
 * Resolve one of the seven bundled sign faces first. The existing Supabase URL
 * remains available as a fallback so an unexpected record does not lose art.
 */
export function getSlipImageSources(slip: SelectedSlip): SlipImageSources {
  const qianNumber = getQianNumber(slip);
  const local = qianNumber == null ? undefined : LOCAL_IMAGE_BY_QIAN_NUMBER[qianNumber];
  const remote = slip.image_url?.trim() || undefined;

  if (local) {
    return { primary: local, fallback: remote, isLocal: true };
  }

  return { primary: remote ?? "", isLocal: false };
}
