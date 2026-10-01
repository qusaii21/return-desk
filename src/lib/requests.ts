import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import type { Prisma, ReturnRequest } from "@/generated/prisma/client";
import type { RequestDetail, RequestSummary } from "@/types/request";

export const withNotes = {
  notes: { select: { id: true, body: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.ReturnRequestInclude;

export function toSummary(r: ReturnRequest): RequestSummary {
  return {
    id: r.id,
    reference: r.reference,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    orderNumber: r.orderNumber,
    itemSku: r.itemSku,
    itemName: r.itemName,
    quantity: r.quantity,
    reason: r.reason,
    status: r.status,
    resolution: r.resolution,
    refundAmount: r.refundAmount === null ? null : r.refundAmount.toNumber(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

type RequestWithNotes = Prisma.ReturnRequestGetPayload<{ include: typeof withNotes }>;

export function toDetail(r: RequestWithNotes): RequestDetail {
  return {
    ...toSummary(r),
    notes: r.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString() })),
  };
}

// Removed requests are treated exactly like requests that never existed.
export async function getLiveRequest(rawId: string) {
  const id = idSchema.parse(rawId);
  const request = await db.returnRequest.findFirst({ where: { id, removedAt: null }, include: withNotes });
  if (!request) throw new ApiError(404, "REQUEST_NOT_FOUND", "No request exists with that id.");
  return request;
}
