import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/errors";
import { checkEditable, checkRemovable } from "@/lib/request-rules";
import { getLiveRequest, toDetail, withNotes } from "@/lib/requests";
import { updateRequestSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req, { params }: Ctx) => {
  return Response.json(toDetail(await getLiveRequest((await params).id)));
});

export const PATCH = handle(async (req, { params }: Ctx) => {
  const current = await getLiveRequest((await params).id);
  const data = updateRequestSchema.parse(await readJson(req));
  checkEditable(current.status);

  // Matching on the status we just checked makes the lock safe against a
  // concurrent transition: if it moved, no row matches and the handler returns 409.
  const updated = await db.returnRequest.update({
    where: { id: current.id, status: current.status, removedAt: null },
    data,
    include: withNotes,
  });
  return Response.json(toDetail(updated));
});

export const DELETE = handle(async (_req, { params }: Ctx) => {
  const current = await getLiveRequest((await params).id);
  checkRemovable(current.status);

  await db.returnRequest.update({
    where: { id: current.id, status: current.status, removedAt: null },
    data: { removedAt: new Date() },
  });
  return new Response(null, { status: 204 });
});
