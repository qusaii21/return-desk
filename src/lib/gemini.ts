import { ApiError } from "@/lib/api-error";
import { REASON_LABELS, RESOLUTION_LABELS, STATUS_LABELS } from "@/lib/request-rules";
import type { RequestDetail } from "@/types/request";

// Default to the alias that follows the current Flash model, so a retired model
// name does not break the feature. Override with GEMINI_MODEL if needed.
const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

function describe(r: RequestDetail) {
  const lines = [
    `Reference: ${r.reference}`,
    `Status: ${STATUS_LABELS[r.status]}`,
    `Customer: ${r.customerName}`,
    `Order: ${r.orderNumber}, item: ${r.itemName} (${r.itemSku}), units: ${r.quantity}`,
    `Reason: ${REASON_LABELS[r.reason]}`,
    `Resolution: ${r.resolution ? RESOLUTION_LABELS[r.resolution] : "none yet"}`,
    r.refundAmount !== null ? `Refund amount: ${r.refundAmount}` : null,
    `Created: ${r.createdAt}`,
    `Notes, oldest first:`,
    ...(r.notes.length ? r.notes.map((n) => `- [${n.createdAt}] ${n.body}`) : ["- none"]),
  ];
  return lines.filter(Boolean).join("\n");
}

export async function summarizeRequest(request: RequestDetail): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ApiError(503, "AI_NOT_CONFIGURED", "AI summaries are not set up on this server.");
  }

  const prompt =
    "You help a returns support agent. Summarise this return request in 3 to 4 plain sentences: " +
    "what the customer wants and why, where the request stands, and what has been noted. " +
    "Use only the facts below and do not invent anything.\n\n" +
    describe(request);

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(502, "AI_UNAVAILABLE", "The AI service could not be reached. Try again in a moment.");
  }
  if (!res.ok) {
    throw new ApiError(502, "AI_UNAVAILABLE", `The AI service refused the request (HTTP ${res.status}).`);
  }

  const data = await res.json();
  const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new ApiError(502, "AI_UNAVAILABLE", "The AI service returned no summary.");
  return text;
}
