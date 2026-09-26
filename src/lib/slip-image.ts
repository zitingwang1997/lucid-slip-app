import type { SelectedSlip } from "@/lib/fortune-store";
import jiJingxinUrl from "@/assets/qian-images/ji-jingxin.webp";
import pingWukongUrl from "@/assets/qian-images/ping-wukong.webp";
import shangjiMingxinAUrl from "@/assets/qian-images/shangji-mingxin-a.webp";
import shangjiMingxinBUrl from "@/assets/qian-images/shangji-mingxin-b.webp";
import xiaShihuaiAUrl from "@/assets/qian-images/xia-shihuai-a.webp";
import xiaShihuaiBUrl from "@/assets/qian-images/xia-shihuai-b.webp";
import zhongpingPojuUrl from "@/assets/qian-images/zhongping-poju.webp";

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

/** Download only the selected sign face once the draw result is known. */
export function preloadSlipImage(slip: SelectedSlip) {
  if (typeof window === "undefined") return;

  const { primary } = getSlipImageSources(slip);
  if (!primary) return;

  const cached = preloadCache.get(primary);
  if (cached) {
    cached.fetchPriority = "high";
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "high";
  image.src = primary;
  preloadCache.set(primary, image);
}

function parseChineseQianNumber(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/^第/, "")
    .replace(/签$/, "")
    .replace(/\s+/g, "")
    .replace(/[壹一]/g, "一")
    .replace(/[贰貳二]/g, "二")
    .replace(/[叁參三]/g, "三")
    .replace(/[肆四]/g, "四")
    .replace(/[伍五]/g, "五")
    .replace(/[陆陸六]/g, "六")
    .replace(/[柒七]/g, "七")
    .replace(/[捌八]/g, "八")
    .replace(/[玖九]/g, "九")
    .replace(/[拾十]/g, "十");

  const arabic = normalized.match(/^(\d{1,2})$/);
  if (arabic) {
    const parsed = Number(arabic[1]);
    return parsed >= 1 && parsed <= 33 ? parsed : null;
  }

  const digitValues: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  let parsed: number | null = null;
  if (normalized === "十") parsed = 10;
  else if (/^十[一二三四五六七八九]$/.test(normalized)) {
    parsed = 10 + digitValues[normalized[1]];
  } else if (/^[二三]十$/.test(normalized)) {
    parsed = digitValues[normalized[0]] * 10;
  } else if (/^[二三]十[一二三四五六七八九]$/.test(normalized)) {
    parsed = digitValues[normalized[0]] * 10 + digitValues[normalized[2]];
  } else if (/^[一二三四五六七八九]$/.test(normalized)) {
    parsed = digitValues[normalized];
  }

  return parsed != null && parsed >= 1 && parsed <= 33 ? parsed : null;
}

function getQianNumber(slip: SelectedSlip): number | null {
  const imageMatch = slip.image_url?.match(/qian_(\d+)\.(?:png|webp)(?:$|[?#])/i);
  if (imageMatch) return Number(imageMatch[1]);

  const id = Number(slip.id);
  if (Number.isInteger(id) && id >= 1 && id <= 33) return id;

  return parseChineseQianNumber(String(slip.number ?? ""));
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
