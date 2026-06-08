import { createServerFn } from "@tanstack/react-start";

export interface TodayQuestion {
  id: string;
  question: string;
  intent?: string;
  category?: string;
}

export interface SimilarityResult {
  /** id of the today entry that is semantically similar, or null if none. */
  matchedId: string | null;
  /** Normalized intent summary for the new question. */
  intent: string;
  /** Coarse category for the new question. */
  category: string;
}

/**
 * Decide whether a new question is "the same intent" as any of today's
 * questions. Uses Lovable AI Gateway (gemini-2.5-flash) with a strict JSON
 * response. Falls back to no-match on any error so the user is never
 * accidentally blocked.
 */
export const checkSameDayQuestion = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { newQuestion: string; today: TodayQuestion[] }) => data,
  )
  .handler(async ({ data }): Promise<SimilarityResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const newQ = (data.newQuestion ?? "").trim();
    const today = Array.isArray(data.today) ? data.today : [];

    const fallback: SimilarityResult = {
      matchedId: null,
      intent: newQ,
      category: "other",
    };
    if (!newQ) return fallback;
    if (!apiKey) {
      console.warn("[similarity] LOVABLE_API_KEY missing; skipping check");
      return fallback;
    }

    const sys = `你是一签 OneSlip 的"同日同问"判定器。任务：判断"新问题"是否与"今日已问问题"中的某一条在情感意图、想要的结果、关切对象上属于"同一困惑的反复追问"。

判定为"同一困惑"的条件（需同时满足）：
1) 情感意图一致（如：渴望复合 / 担心被遗忘 / 焦虑前途 / 求是否被爱）。
2) 想要的结果一致（如：知道对方心意 / 决定是否离职 / 是否能成）。
3) 同一类别且指向同一关切对象或同一情境。

示例同一困惑：
- "他还喜欢我吗？" / "他心里还有我吗？" / "我们还有可能复合吗？"
- "这份工作我该不该辞？" / "我留在这里有意义吗？"

示例不同：
- "他还喜欢我吗？" vs "我该换工作吗？"（不同类别）
- "我和A还有可能吗？" vs "我和B合适吗？"（对象不同）

类别从以下集合中选择一个：relationship / career / money / health / family / study / decision / self / other。

仅返回严格 JSON，不要 markdown，不要解释。结构：
{"matchedId": string|null, "intent": string, "category": string}
intent 是新问题的简短意图归纳（中文，<=20字）。matchedId 为命中的今日问题 id，没有则为 null。`;

    const userMsg = JSON.stringify({
      new_question: newQ,
      today_questions: today.map((t) => ({
        id: t.id,
        question: t.question,
        intent: t.intent,
        category: t.category,
      })),
    });

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.warn("[similarity] gateway error", res.status, t.slice(0, 200));
        return fallback;
      }
      const json: any = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      let parsed: any = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        const first = content.indexOf("{");
        const last = content.lastIndexOf("}");
        if (first !== -1 && last > first) {
          try {
            parsed = JSON.parse(content.slice(first, last + 1));
          } catch {}
        }
      }
      if (!parsed || typeof parsed !== "object") return fallback;
      const matchedRaw = parsed.matchedId;
      const matchedId =
        typeof matchedRaw === "string" && today.some((t) => t.id === matchedRaw)
          ? matchedRaw
          : null;
      return {
        matchedId,
        intent:
          typeof parsed.intent === "string" && parsed.intent
            ? parsed.intent.slice(0, 60)
            : newQ.slice(0, 60),
        category:
          typeof parsed.category === "string" && parsed.category
            ? parsed.category
            : "other",
      };
    } catch (err) {
      console.warn("[similarity] exception", err);
      return fallback;
    }
  });
