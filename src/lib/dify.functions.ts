import { createServerFn } from "@tanstack/react-start";

function tryParseJSON(v: unknown): any {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

async function callDifyWorkflow(
  apiKey: string,
  inputs: Record<string, unknown>,
  label: string,
) {
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
  console.log(`[Dify ${label}] raw response:`, text.slice(0, 1500));
  let outputs = json?.data?.outputs ?? {};
  // If outputs is a string, try to parse it as JSON.
  if (typeof outputs === "string") {
    const parsed = tryParseJSON(outputs);
    if (parsed && typeof parsed === "object") outputs = parsed;
  }
  // If there's a single key wrapping the real payload as a JSON string, unwrap it.
  const keys = Object.keys(outputs ?? {});
  if (keys.length === 1) {
    const only = (outputs as any)[keys[0]];
    const parsed = tryParseJSON(only);
    if (parsed && typeof parsed === "object") outputs = parsed;
  }
  // Also try parsing string-valued fields like `slip` that may be JSON strings.
  for (const k of Object.keys(outputs ?? {})) {
    const v = (outputs as any)[k];
    if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) {
      const parsed = tryParseJSON(v);
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
    const outputs = await callDifyWorkflow(
      apiKey,
      { user_question: data?.user_question ?? "" },
      "draw",
    );
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
        qian_data:
          typeof data.qian_data === "string"
            ? data.qian_data
            : JSON.stringify(data.qian_data ?? {}),
      },
      "interpret",
    );
    return outputs;
  });

// Workflow A: draw a random fortune slip
export const drawSlip = createServerFn({ method: "POST" })
  .inputValidator((data: { user_question?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const apiKey = process.env.DIFY_DRAW_API_KEY;
    if (!apiKey) throw new Error("DIFY_DRAW_API_KEY missing");
    const outputs = await callDifyWorkflow(apiKey, {
      user_question: data?.user_question ?? "",
    });
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
    const outputs = await callDifyWorkflow(apiKey, {
      user_question: data.user_question ?? "",
      qian_data:
        typeof data.qian_data === "string"
          ? data.qian_data
          : JSON.stringify(data.qian_data ?? {}),
    });
    return outputs;
  });
