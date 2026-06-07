import { createServerFn } from "@tanstack/react-start";

function tryParseJSON(v: unknown): any {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

async function callDifyWorkflow(apiKey: string, inputs: Record<string, unknown>, label: string) {
  const baseUrl = (process.env.DIFY_BASE_URL ?? "https://api.dify.ai/v1").replace(/\/$/, "");
  console.log(`[Dify ${label}] request inputs:`, JSON.stringify(inputs).slice(0, 500));
  const res = await fetch(`${baseUrl}/workflows/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs,
      response_mode: "blocking",
      user: "oneslip-web",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[Dify ${label}] error`, res.status, text);
    throw new Error(`Dify request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Dify returned non-JSON response");
  }
  console.log(`[Dify ${label}] raw response:`, text.slice(0, 2000));

  // Detect workflow-level failure (HTTP 200 but data.status === "failed").
  const status = json?.data?.status;
  const wfError = json?.data?.error;
  if (status && status !== "succeeded") {
    const msg = typeof wfError === "string" ? wfError : JSON.stringify(wfError ?? {});
    console.error(`[Dify ${label}] workflow status=${status} error:`, msg);
    throw new Error(`Dify workflow ${label} ${status}: ${msg.slice(0, 400)}`);
  }

  let outputs: any = json?.data?.outputs ?? json?.outputs ?? json?.result ?? json?.output ?? {};

  // Unwrap string outputs / fenced ```json blocks.
  const unfence = (s: string) =>
    s
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  if (typeof outputs === "string") {
    const parsed = tryParseJSON(unfence(outputs));
    if (parsed && typeof parsed === "object") outputs = parsed;
  }
  // If single-key wrapper holds the real payload as a JSON string, unwrap it.
  const keys = Object.keys(outputs ?? {});
  if (keys.length === 1) {
    const only = (outputs as any)[keys[0]];
    if (typeof only === "string") {
      const parsed = tryParseJSON(unfence(only));
      if (parsed && typeof parsed === "object") outputs = parsed;
    }
  }
  // Parse string-valued fields that look like JSON (e.g. slip).
  for (const k of Object.keys(outputs ?? {})) {
    const v = (outputs as any)[k];
    if (typeof v === "string" && (v.trim().startsWith("{") || v.trim().startsWith("[") || v.trim().startsWith("```"))) {
      const parsed = tryParseJSON(unfence(v));
      if (parsed && typeof parsed === "object") (outputs as any)[k] = parsed;
    }
  }
  console.log(`[Dify ${label}] parsed outputs keys:`, Object.keys(outputs ?? {}));
  return outputs;
}

// Workflow A: draw a random fortune slip
export const drawSlip = createServerFn({ method: "POST" })
  .inputValidator((data: { user_question?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const apiKey = process.env.DIFY_DRAW_API_KEY;
    if (!apiKey) throw new Error("DIFY_DRAW_API_KEY missing");
    const outputs = await callDifyWorkflow(apiKey, { user_question: data?.user_question ?? "" }, "draw");
    const slip = outputs.slip ?? outputs.qian ?? outputs;
    const user_question = outputs.user_question ?? data?.user_question ?? "";
    return { user_question, slip };
  });

// Workflow B: interpret a selected slip
export const interpretSlip = createServerFn({ method: "POST" })
  .inputValidator((data: { user_question: string; qian_data: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.DIFY_INTERPRET_API_KEY;
    if (!apiKey) throw new Error("DIFY_INTERPRET_API_KEY missing");
    const outputs = await callDifyWorkflow(
      apiKey,
      {
        user_question: data.user_question ?? "",
        qian_data: typeof data.qian_data === "string" ? data.qian_data : JSON.stringify(data.qian_data ?? {}),
      },
      "interpret",
    );
    const o: any = outputs ?? {};

    // Workflow B returns a single `result` string containing JSON.
    let parsed: any = null;
    const rawResult = o.result ?? o.output ?? o.text;
    if (typeof rawResult === "string") {
      let s = rawResult.trim();
      s = s
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const first = s.indexOf("{");
      const last = s.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        s = s.slice(first, last + 1);
      }
      try {
        parsed = JSON.parse(s);
      } catch (err) {
        console.warn("[Dify interpret] JSON.parse failed, trying jsonrepair:", err);
        try {
          const { jsonrepair } = await import("jsonrepair");
          parsed = JSON.parse(jsonrepair(s));
          console.log("[Dify interpret] jsonrepair succeeded");
        } catch (err2) {
          console.error("[Dify interpret] jsonrepair also failed:", err2, s.slice(0, 1000));
          throw new Error("解签结果解析失败：Workflow B result 不是合法 JSON");
        }
      }
    } else if (rawResult && typeof rawResult === "object") {
      parsed = rawResult;
    } else {
      parsed = o;
    }

    const reading = parsed?.reading ?? parsed ?? {};
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = reading?.[k] ?? parsed?.[k];
        if (v != null && v !== "") return v;
      }
      return undefined;
    };
    const pickContent = (obj: any, ...keys: string[]) => {
      for (const k of keys) {
        const node = obj?.[k];
        if (typeof node === "string" && node) return node;
        if (node && typeof node === "object") {
          const c = node.content ?? node.text ?? node.body ?? node.description;
          if (typeof c === "string" && c) return c;
        }
      }
      return "";
    };
    const pickTitle = (obj: any, fallback: string, ...keys: string[]) => {
      for (const k of keys) {
        const node = obj?.[k];
        if (node && typeof node === "object" && typeof node.title === "string" && node.title) {
          return node.title;
        }
      }
      return fallback;
    };
    const xiangKeys = ["xiang", "symbol", "image", "omen"];
    const yiKeys = ["yi", "meaning", "interpretation"];
    const xingKeys = ["xing", "action", "guidance", "next_step"];

    const normalized = {
      slip: parsed?.slip ?? o.slip ?? undefined,
      xiang_title:
        pickTitle(reading, "", ...xiangKeys) || pickTitle(parsed, "", ...xiangKeys) || parsed?.xiang_title || "象",
      xiang_content:
        pickContent(reading, ...xiangKeys) ||
        pickContent(parsed, ...xiangKeys) ||
        (typeof pick("xiang_content") === "string" ? (pick("xiang_content") as string) : ""),
      yi_title: pickTitle(reading, "", ...yiKeys) || pickTitle(parsed, "", ...yiKeys) || parsed?.yi_title || "意",
      yi_content:
        pickContent(reading, ...yiKeys) ||
        pickContent(parsed, ...yiKeys) ||
        (typeof pick("yi_content") === "string" ? (pick("yi_content") as string) : ""),
      xing_title:
        pickTitle(reading, "", ...xingKeys) || pickTitle(parsed, "", ...xingKeys) || parsed?.xing_title || "行",
      xing_content:
        pickContent(reading, ...xingKeys) ||
        pickContent(parsed, ...xingKeys) ||
        (typeof pick("xing_content") === "string" ? (pick("xing_content") as string) : ""),
      disclaimer: parsed?.disclaimer ?? o.disclaimer ?? "",
    };

    console.log("[Dify interpret] normalized:", JSON.stringify(normalized).slice(0, 500));
    const hasContent = normalized.xiang_content || normalized.yi_content || normalized.xing_content;
    if (!hasContent) {
      console.error("[Dify interpret] empty outputs:", JSON.stringify(o).slice(0, 500));
      throw new Error("Workflow B 返回内容为空");
    }
    return normalized;
  });

// Workflow C: generate a selected remedy kit
export const getRemedyKit = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { user_question: string; qian_data: string; interpretation: string; kit_type: string }) => data,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.DIFY_REMEDY_API_KEY;
    if (!apiKey) throw new Error("DIFY_REMEDY_API_KEY missing");

    const outputs = await callDifyWorkflow(
      apiKey,
      {
        user_question: data.user_question ?? "",
        qian_data: typeof data.qian_data === "string" ? data.qian_data : JSON.stringify(data.qian_data ?? {}),
        interpretation:
          typeof data.interpretation === "string" ? data.interpretation : JSON.stringify(data.interpretation ?? {}),
        kit_type: data.kit_type ?? "",
      },
      "remedy",
    );

    const o: any = outputs ?? {};

    const normalized = {
      kit_title: String(o.kit_title ?? o.title ?? ""),
      kit_subtitle: String(o.kit_subtitle ?? o.subtitle ?? ""),
      kit_content: String(o.kit_content ?? o.content ?? ""),
      kit_action: String(o.kit_action ?? o.action ?? ""),
      disclaimer: String(o.disclaimer ?? "此内容仅用于自我反思，不代表确定的命运判断。"),
    };

    console.log("[Dify remedy] normalized:", JSON.stringify(normalized).slice(0, 500));

    const hasContent = normalized.kit_title || normalized.kit_content || normalized.kit_action;

    if (!hasContent) {
      console.error("[Dify remedy] empty outputs:", JSON.stringify(o).slice(0, 500));
      throw new Error("锦囊内容为空，请稍后再试");
    }

    return normalized;
  });
