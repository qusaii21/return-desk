import { handle } from "@/lib/errors";
import { summarizeRequest } from "@/lib/gemini";
import { getLiveRequest, toDetail } from "@/lib/requests";

export const POST = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const request = toDetail(await getLiveRequest((await params).id));
  return Response.json({ summary: await summarizeRequest(request) });
});
