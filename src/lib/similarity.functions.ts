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
  /** Confidence in the match decision, 0..1. */
  confidence: number;
  /** Short human-readable reason for the decision. */
  reason: string;
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
      confidence: 0,
      reason: "fallback",
    };
    if (!newQ) return fallback;
    if (!apiKey) {
      console.warn("[similarity] LOVABLE_API_KEY missing; skipping check");
      return fallback;
    }

    const sys = `你是一签 OneSlip 的"同日同问"语义判定器。

任务：判断"新问题"是否与"今日已问问题"中的某一条在**核心关切、情感意图、生活领域**上属于"同一困惑"。比较的是语义，不是字面措辞。

判定为"同一困惑"的标准（满足其一即可视为高相似）：
1) 同一情感意图（如：渴望复合 / 害怕被抛弃 / 想知道对方心意 / 焦虑前途）。
2) 同一关切对象 + 同一类别（如：都在问与同一段感情的走向）。
3) 想要的结果一致（如：是否能复合 / 是否该辞职 / 是否被爱）。

视为"相似"的范例（应匹配）：
- "我和他还有可能吗" / "他还会回来找我吗" / "这段关系还有机会吗" / "我们会不会复合"
- "这份工作我该不该辞" / "我留在这里有意义吗" / "要不要换工作"
- "他还喜欢我吗" / "他心里还有我吗"

视为"不同"的范例（不应匹配）：
- 一个问感情、一个问事业
- 一个问金钱、一个问健康
- 同一人但明显不同决策（"要不要和他在一起" vs "要不要和他一起创业"）
- 同类别但不同对象（"我和A还有可能吗" vs "我和B合适吗"）

category 必须从以下集合中选择一个：relationship / career / family / money / health / self / other。

confidence 是你对"是否同一困惑"判断的把握度，0 到 1。
- >= 0.72：判定为匹配，请在 matchedId 填入命中条目的 id。
- < 0.72：判定为不匹配，matchedId 为 null。
- 若新问题与某条今日问题属同 category 且核心意图非常接近，即使措辞不同，也应给 >= 0.72。

仅返回严格 JSON，不要 markdown、不要解释文本。结构：
{"matchedId": string|null, "intent": string, "category": string, "confidence": number, "reason": string}
intent 为新问题的简短中文意图归纳（<=20字）。reason 为简短中文判定理由（<=40字）。`;

    const userMsg = JSON.stringify({
      new_question: newQ,
      today_questions: today.map((t) => ({
        id: t.id,
        question: t.question,
        intent: t.intent,
        category: t.category,
      })),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
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
        signal: controller.signal,
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
      const confidence =
        typeof parsed.confidence === "number" && isFinite(parsed.confidence)
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0;
      const candidateId =
        typeof matchedRaw === "string" && today.some((t) => t.id === matchedRaw)
          ? matchedRaw
          : null;

      // Hard threshold: require >= 0.72 confidence to honor the match.
      const matchedId = candidateId && confidence >= 0.72 ? candidateId : null;

      const result: SimilarityResult = {
        matchedId,
        intent:
          typeof parsed.intent === "string" && parsed.intent
            ? parsed.intent.slice(0, 60)
            : newQ.slice(0, 60),
        category:
          typeof parsed.category === "string" && parsed.category
            ? parsed.category
            : "other",
        confidence,
        reason:
          typeof parsed.reason === "string" ? parsed.reason.slice(0, 120) : "",
      };
      console.log("[similarity] decision", {
        candidateId,
        matchedId: result.matchedId,
        confidence,
        category: result.category,
        intent: result.intent,
        reason: result.reason,
      });
      return result;
    } catch (err) {
      console.warn("[similarity] exception", err);
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  });
