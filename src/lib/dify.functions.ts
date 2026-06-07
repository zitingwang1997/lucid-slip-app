import { createServerFn } from "@tanstack/react-start";

async function callDifyWorkflow(apiKey: string, inputs: Record<string, unknown>) {
  const baseUrl = (process.env.DIFY_BASE_URL ?? "https://api.dify.ai/v1").replace(/\/$/, "");
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
    console.error("Dify error", res.status, text);
    throw new Error(`Dify request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Dify returned non-JSON response");
  }
  const outputs = json?.data?.outputs ?? {};
  // Dify workflows sometimes wrap a single output as a JSON string under a key.
  // Try to unwrap: if there's a single string output that parses as JSON, use that.
  const keys = Object.keys(outputs);
  if (keys.length === 1 && typeof outputs[keys[0]] === "string") {
    try {
      const parsed = JSON.parse(outputs[keys[0]]);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return outputs;
}

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
