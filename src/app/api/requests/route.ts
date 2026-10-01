import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/errors";
import { toSummary, toDetail, withNotes } from "@/lib/requests";
import { createRequestSchema, listQuerySchema } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

export const GET = handle(async (req) => {
  const { search, status, reason, sort, order, page, pageSize } = listQuerySchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );

  const where: Prisma.ReturnRequestWhereInput = {
    removedAt: null,
    status,
    reason,
    ...(search && {
      OR: [
        { reference: { contains: search, mode: "insensitive" } },
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [total, rows] = await db.$transaction([
    db.returnRequest.count({ where }),
    db.returnRequest.findMany({
      where,
      orderBy: [{ [sort]: order }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return Response.json({
    data: rows.map(toSummary),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
});

export const POST = handle(async (req) => {
  const data = createRequestSchema.parse(await readJson(req));
  const created = await db.returnRequest.create({ data, include: withNotes });
  return Response.json(toDetail(created), { status: 201 });
});
