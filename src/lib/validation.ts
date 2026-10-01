import { z } from "zod";
import { REASONS, RESOLUTIONS, STATUSES } from "@/lib/request-rules";

export const idSchema = z.uuid("Request id must be a valid UUID.");

// Order numbers, SKUs and emails are normalised so the one-live-request rule
// cannot be dodged by changing case or adding spaces.
export const createRequestSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required.").max(100),
  customerEmail: z.email("Enter a valid email address.").trim().toLowerCase().max(200),
  customerPhone: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v || null)
    .nullable()
    .optional(),
  orderNumber: z.string().trim().toUpperCase().min(1, "Order number is required.").max(40),
  itemSku: z.string().trim().toUpperCase().min(1, "Item SKU is required.").max(40),
  itemName: z.string().trim().min(1, "Item name is required.").max(150),
  quantity: z.number("Quantity must be a number.").int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(999),
  reason: z.enum(REASONS, "Choose a valid reason."),
});

export const updateRequestSchema = createRequestSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Send at least one field to update.");

export const transitionSchema = z.object({
  status: z.enum(STATUSES, "Choose a valid status."),
  resolution: z.enum(RESOLUTIONS, "Resolution must be Refund, Replacement or Store Credit.").nullish(),
  refundAmount: z
    .number("Refund amount must be a number.")
    .max(99_999_999.99)
    .multipleOf(0.01, "Refund amount can have at most two decimal places.")
    .nullish(),
});

export const noteSchema = z.object({
  body: z.string().trim().min(1, "A note cannot be empty.").max(2000, "A note can be at most 2000 characters."),
});

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  reason: z.enum(REASONS).optional(),
  sort: z.enum(["createdAt", "updatedAt", "reference", "customerName", "status"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
