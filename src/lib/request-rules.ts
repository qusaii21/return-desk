import { ApiError } from "@/lib/api-error";

export const STATUSES = ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "COMPLETED"] as const;
export const REASONS = ["DAMAGED", "WRONG_ITEM", "SIZE_ISSUE", "NOT_AS_DESCRIBED", "CHANGED_MIND"] as const;
export const RESOLUTIONS = ["REFUND", "REPLACEMENT", "STORE_CREDIT"] as const;

export type Status = (typeof STATUSES)[number];
export type Reason = (typeof REASONS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

export const STATUS_LABELS: Record<Status, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

export const REASON_LABELS: Record<Reason, string> = {
  DAMAGED: "Damaged",
  WRONG_ITEM: "Wrong Item",
  SIZE_ISSUE: "Size Issue",
  NOT_AS_DESCRIBED: "Not As Described",
  CHANGED_MIND: "Changed Mind",
};

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  REFUND: "Refund",
  REPLACEMENT: "Replacement",
  STORE_CREDIT: "Store Credit",
};

// Rule 1. The UI reads this same table to decide which buttons to offer.
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  OPEN: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

// Rule 4: once decided, customer and item details are locked.
export const isLocked = (status: Status) =>
  status === "APPROVED" || status === "REJECTED" || status === "COMPLETED";

// Rule 5: only Open and Rejected requests can be taken off the desk.
export const canRemove = (status: Status) => status === "OPEN" || status === "REJECTED";

export function checkTransition(from: Status, to: Status) {
  if (!TRANSITIONS[from].includes(to)) {
    throw new ApiError(
      409,
      "INVALID_STATUS_TRANSITION",
      `A request in ${STATUS_LABELS[from]} status cannot be moved to ${STATUS_LABELS[to]}.`,
    );
  }
}

// Rule 2. Returns the resolution fields to store with the transition.
export function resolutionFor(to: Status, resolution?: Resolution | null, refundAmount?: number | null) {
  if (to !== "APPROVED") {
    if (resolution || refundAmount != null) {
      throw new ApiError(422, "INVALID_RESOLUTION", "A resolution can only be set when approving a request.");
    }
    return {};
  }
  if (!resolution) {
    throw new ApiError(
      422,
      "INVALID_RESOLUTION",
      "Approving a request needs a resolution: Refund, Replacement or Store Credit.",
    );
  }
  if (resolution === "REFUND") {
    if (refundAmount == null || refundAmount <= 0) {
      throw new ApiError(422, "INVALID_REFUND_AMOUNT", "A Refund needs a refund amount greater than zero.");
    }
    return { resolution, refundAmount };
  }
  if (refundAmount != null) {
    throw new ApiError(
      422,
      "INVALID_REFUND_AMOUNT",
      `A refund amount cannot be recorded for a ${RESOLUTION_LABELS[resolution]} resolution.`,
    );
  }
  return { resolution, refundAmount: null };
}

export function checkEditable(status: Status) {
  if (isLocked(status)) {
    throw new ApiError(
      409,
      "REQUEST_LOCKED",
      `A request in ${STATUS_LABELS[status]} status can no longer be edited.`,
    );
  }
}

export function checkRemovable(status: Status) {
  if (!canRemove(status)) {
    throw new ApiError(
      409,
      "REMOVAL_NOT_ALLOWED",
      `A request in ${STATUS_LABELS[status]} status cannot be removed. Only Open or Rejected requests can.`,
    );
  }
}
