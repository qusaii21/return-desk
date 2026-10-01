import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/errors";
import { checkTransition, resolutionFor } from "@/lib/request-rules";
import { getLiveRequest, toDetail, withNotes } from "@/lib/requests";
import { transitionSchema } from "@/lib/validation";

export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const current = await getLiveRequest((await params).id);
  const { status, resolution, refundAmount } = transitionSchema.parse(await readJson(req));

  checkTransition(current.status, status);
  const resolutionFields = resolutionFor(status, resolution, refundAmount);

  const updated = await db.returnRequest.update({
    where: { id: current.id, status: current.status, removedAt: null },
    data: { status, ...resolutionFields },
    include: withNotes,
  });
  return Response.json(toDetail(updated));
});
