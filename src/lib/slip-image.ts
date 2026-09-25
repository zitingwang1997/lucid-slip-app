import type { SelectedSlip } from "@/lib/fortune-store";

const LOCAL_IMAGE_BY_QIAN_NUMBER: Record<number, string> = {
  1: "/qian-images/shangji-mingxin-a.webp",
  2: "/qian-images/shangji-mingxin-b.webp",
  3: "/qian-images/shangji-mingxin-a.webp",
  4: "/qian-images/shangji-mingxin-b.webp",
  5: "/qian-images/shangji-mingxin-a.webp",
  6: "/qian-images/shangji-mingxin-b.webp",
  7: "/qian-images/ji-jingxin.webp",
  8: "/qian-images/ji-jingxin.webp",
  9: "/qian-images/ji-jingxin.webp",
  10: "/qian-images/ji-jingxin.webp",
  11: "/qian-images/ji-jingxin.webp",
  12: "/qian-images/ji-jingxin.webp",
  13: "/qian-images/zhongping-poju.webp",
  14: "/qian-images/zhongping-poju.webp",
  15: "/qian-images/zhongping-poju.webp",
  16: "/qian-images/zhongping-poju.webp",
  17: "/qian-images/zhongping-poju.webp",
  18: "/qian-images/zhongping-poju.webp",
  19: "/qian-images/xia-shihuai-a.webp",
  20: "/qian-images/xia-shihuai-b.webp",
  21: "/qian-images/xia-shihuai-b.webp",
  22: "/qian-images/xia-shihuai-a.webp",
  23: "/qian-images/xia-shihuai-a.webp",
  24: "/qian-images/xia-shihuai-b.webp",
  25: "/qian-images/ping-wukong.webp",
  26: "/qian-images/ping-wukong.webp",
  27: "/qian-images/ping-wukong.webp",
  28: "/qian-images/ping-wukong.webp",
  29: "/qian-images/ping-wukong.webp",
  30: "/qian-images/ping-wukong.webp",
  31: "/qian-images/shangji-mingxin-a.webp",
  32: "/qian-images/shangji-mingxin-a.webp",
  33: "/qian-images/shangji-mingxin-b.webp",
};

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
