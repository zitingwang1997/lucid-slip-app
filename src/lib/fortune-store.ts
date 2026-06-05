export interface FortuneEntry {
  id: string;
  number: number;
  question: string;
  poem: string[];
  createdAt: number;
  reflection?: { type: "问心" | "释念" | "行愿"; note: string };
}

const KEY = "oneslip.entries.v1";
const PENDING = "oneslip.pending.v1";

export function loadEntries(): FortuneEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FortuneEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntry(entry: FortuneEntry) {
  if (typeof window === "undefined") return;
  const list = loadEntries();
  const existing = list.findIndex((e) => e.id === entry.id);
  if (existing >= 0) list[existing] = entry;
  else list.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
}

export function setPending(entry: FortuneEntry) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING, JSON.stringify(entry));
}

export function getPending(): FortuneEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING);
    return raw ? (JSON.parse(raw) as FortuneEntry) : null;
  } catch {
    return null;
  }
}

export function clearPending() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING);
}

// Curated poetic fortunes — quiet, restrained, contemplative
export const POEMS: { number: number; lines: string[] }[] = [
  { number: 7, lines: ["静水深流自有声", "无言花开见月明", "心若安处皆是岸", "何须问路向天行"] },
  { number: 13, lines: ["云开雾散见天光", "旧事如烟莫再藏", "今朝拂袖前行去", "万里清风共一觞"] },
  { number: 21, lines: ["落叶随风入梦深", "一灯如豆照孤心", "莫嗟岁月催人老", "且听檐前夜雨音"] },
  { number: 28, lines: ["竹影摇窗月正寒", "归人未至意阑珊", "此心若问归何处", "且向枕边寻旧欢"] },
  { number: 33, lines: ["雪落无声夜自长", "炉中火暖煮茶香", "人间冷暖原如此", "一念清凉一念霜"] },
  { number: 38, lines: ["山重水复疑无路", "柳暗花明又一村", "行至半途莫回首", "风来云散见乾坤"] },
  { number: 44, lines: ["孤舟蓑笠雨潇潇", "独钓寒江月一篙", "得失原非身外物", "随波亦自有逍遥"] },
  { number: 51, lines: ["庭前梅落不知春", "屋角风来唤旧人", "若问浮生何所似", "一炉香尽一回身"] },
  { number: 56, lines: ["千山未尽万山来", "脚下尘埃手中杯", "莫道此身无处去", "归途即是出门台"] },
  { number: 63, lines: ["檐外青苔深复深", "案头残墨字犹新", "纵然世事如流水", "此意长存岁岁春"] },
  { number: 72, lines: ["风过松林响似潮", "心如止水自能调", "繁华落尽方知静", "一夜清光照寂寥"] },
  { number: 81, lines: ["万象更新天地宽", "旧时心事付云端", "前程不必苦相问", "脚下生花步步安"] },
];

export function drawFortune(): { number: number; lines: string[] } {
  return POEMS[Math.floor(Math.random() * POEMS.length)];
}

// Mock interpretive copy — calm, compassionate, non-predictive
export function interpretFor(question: string, poem: string[]) {
  const q = question.trim() || "你心中的那个问题";
  return {
    deeperQuestion: `你问的是「${q}」，但你真正想知道的，也许并不是答案本身——而是你能否允许自己，在不确定中继续前行。这份犹疑，恰恰说明你正在认真地对待自己的人生。`,
    poemMeaning: `这支签以「${poem[0]}」起笔，看似写景，其实写心。它没有告诉你该怎么选，而是提醒你：眼前的迷雾不是终点，是路途中必经的一段。当你愿意慢下来，让心先安静，方向自会从模糊中显现。`,
    paths: [
      { key: "问心" as const, hint: "在此刻，安静地问自己一句：我真正想要的是什么？把第一个浮现的念头写下来，不评判。" },
      { key: "释念" as const, hint: "选一件你正在反复思虑、却暂时无力改变的事。轻声说：「我先把你放下，明日再见。」然后做一次深呼吸。" },
      { key: "行愿" as const, hint: "今天为这件事做一个最小的动作——一条消息、一次散步、一页书。不必完美，只需开始。" },
    ],
  };
}
