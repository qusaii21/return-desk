import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/errors";
import { getLiveRequest } from "@/lib/requests";
import { noteSchema } from "@/lib/validation";

export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const request = await getLiveRequest((await params).id);
  const { body } = noteSchema.parse(await readJson(req));
  const note = await db.note.create({ data: { requestId: request.id, body } });
  return Response.json(
    { id: note.id, body: note.body, createdAt: note.createdAt.toISOString() },
    { status: 201 },
  );
});
