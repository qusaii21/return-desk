-- CreateEnum
CREATE TYPE "Status" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Reason" AS ENUM ('DAMAGED', 'WRONG_ITEM', 'SIZE_ISSUE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND');

-- CreateEnum
CREATE TYPE "Resolution" AS ENUM ('REFUND', 'REPLACEMENT', 'STORE_CREDIT');

-- Source of the numeric part of the human-readable reference (RET-2026-000001)
CREATE SEQUENCE return_reference_seq;

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL DEFAULT (('RET-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((nextval('return_reference_seq'::regclass))::text, 6, '0'::text),
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "orderNumber" TEXT NOT NULL,
    "itemSku" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "Reason" NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'OPEN',
    "resolution" "Resolution",
    "refundAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quantity_positive" CHECK ("quantity" > 0),
    -- Approved and Completed requests always carry a resolution
    CONSTRAINT "decided_has_resolution" CHECK ("status" NOT IN ('APPROVED', 'COMPLETED') OR "resolution" IS NOT NULL),
    -- A refund amount exists exactly when the resolution is Refund, and is positive
    CONSTRAINT "refund_matches_resolution" CHECK (("resolution" = 'REFUND') = ("refundAmount" IS NOT NULL)),
    CONSTRAINT "refund_positive" CHECK ("refundAmount" IS NULL OR "refundAmount" > 0)
);

-- CreateTable
CREATE TABLE "Note" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_reference_key" ON "ReturnRequest"("reference");

-- CreateIndex
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");

-- CreateIndex
CREATE INDEX "ReturnRequest_reason_idx" ON "ReturnRequest"("reason");

-- CreateIndex
CREATE INDEX "ReturnRequest_createdAt_idx" ON "ReturnRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Note_requestId_createdAt_idx" ON "Note"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rule 3: one live request per item on an order. Live means not yet Rejected or
-- Completed, and not removed from the desk.
CREATE UNIQUE INDEX "one_live_request_per_item"
    ON "ReturnRequest" ("orderNumber", "itemSku")
    WHERE "status" NOT IN ('REJECTED', 'COMPLETED') AND "removedAt" IS NULL;

-- Notes are immutable: the database refuses edits and deletes too.
CREATE FUNCTION forbid_note_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Notes cannot be edited or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_is_immutable
    BEFORE UPDATE OR DELETE ON "Note"
    FOR EACH ROW EXECUTE FUNCTION forbid_note_change();
