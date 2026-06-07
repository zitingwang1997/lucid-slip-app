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
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Dify returned non-JSON response");
  }
}

// Workflow A: draw a random fortune slip
export const drawSlip = createServerFn({ method: "POST" })
  .inputValidator((data: { user_question?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const apiKey = process.env.DIFY_DRAW_API_KEY;
    if (!apiKey) throw new Error("DIFY_DRAW_API_KEY missing");
    const inputs: Record<string, unknown> = {};
    if (data?.user_question) inputs.user_question = data.user_question;
    const json = await callDifyWorkflow(apiKey, inputs);
    const outputs = json?.data?.outputs ?? {};
    // Try common shapes: outputs.slip, outputs.qian, or outputs itself
    const slip =
      outputs.slip ??
      outputs.qian ??
      outputs.qian_data ??
      outputs.result ??
      outputs;
    return { slip, raw: outputs };
  });

// Workflow B: interpret a selected slip
export const interpretSlip = createServerFn({ method: "POST" })
  .inputValidator((data: { user_question: string; qian_data: unknown }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.DIFY_INTERPRET_API_KEY;
    if (!apiKey) throw new Error("DIFY_INTERPRET_API_KEY missing");
    const inputs = {
      user_question: data.user_question ?? "",
      qian_data:
        typeof data.qian_data === "string"
          ? data.qian_data
          : JSON.stringify(data.qian_data ?? {}),
    };
    const json = await callDifyWorkflow(apiKey, inputs);
    const outputs = json?.data?.outputs ?? {};
    const result = outputs.result ?? outputs;
    return { result, raw: outputs };
  });
