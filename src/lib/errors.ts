import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";

function errorResponse(status: number, code: string, message: string, details?: Record<string, string[]>) {
  return Response.json({ error: { code, message, details } }, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
}

// Wraps a route handler so every failure leaves as the same JSON error shape.
export function handle<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.status, err.code, err.message, err.details);
      }
      if (err instanceof z.ZodError) {
        const fields = z.flattenError(err).fieldErrors as Record<string, string[]>;
        const message = err.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
          .join("; ");
        return errorResponse(400, "VALIDATION_ERROR", message, fields);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // The only unique constraint a client can hit is one_live_request_per_item.
        if (err.code === "P2002") {
          return errorResponse(
            409,
            "DUPLICATE_LIVE_REQUEST",
            "This customer already has a live request for this item on this order.",
          );
        }
        // A conditional update found no row: the request changed after we read it.
        if (err.code === "P2025") {
          return errorResponse(
            409,
            "REQUEST_CHANGED",
            "This request was changed by someone else. Reload it and try again.",
          );
        }
      }
      console.error(err);
      return errorResponse(500, "INTERNAL_ERROR", "Unexpected server error.");
    }
  };
}
