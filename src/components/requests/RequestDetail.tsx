"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetch-json";
import {
  REASON_LABELS,
  RESOLUTIONS,
  RESOLUTION_LABELS,
  STATUS_LABELS,
  TRANSITIONS,
  canRemove,
  isLocked,
  type Resolution,
  type Status,
} from "@/lib/request-rules";
import type { Note, RequestDetail as RequestDetailType } from "@/types/request";
import { formatDateTime, formatMoney } from "./format";
import { RequestForm } from "./RequestForm";
import { StatusBadge } from "./StatusBadge";

const MOVE_LABELS: Partial<Record<Status, string>> = {
  IN_REVIEW: "Start review",
  APPROVED: "Approve request",
  REJECTED: "Reject request",
  COMPLETED: "Complete request",
};

const field = "field";
const card = "panel p-4 sm:p-6";

type Load = { id: string; request?: RequestDetailType; error?: string };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[#6b7280]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[#1a1a1a]">{children}</dd>
    </div>
  );
}

export function RequestDetail({ id, justCreated }: { id: string; justCreated: boolean }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>();
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [refund, setRefund] = useState("");
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string | undefined>(justCreated ? "Request created." : undefined);

  useEffect(() => {
    let current = true;
    api<RequestDetailType>(`/api/requests/${id}`)
      .then((request) => current && setLoad({ id, request }))
      .catch((err: Error) => current && setLoad({ id, error: err.message }));
    return () => {
      current = false;
    };
  }, [id]);

  const request = load?.id === id ? load.request : undefined;
  const setRequest = (updated: RequestDetailType) => setLoad({ id, request: updated });

  async function run<T>(action: () => Promise<T>, onDone: (result: T) => void) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      onDone(await action());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function move(status: Status, extra: { resolution?: Resolution; refundAmount?: number } = {}) {
    run(
      () =>
        api<RequestDetailType>(`/api/requests/${id}/transition`, {
          method: "POST",
          body: JSON.stringify({ status, ...extra }),
        }),
      (updated) => {
        setRequest(updated);
        setApproving(false);
        setNotice(`Status changed to ${STATUS_LABELS[updated.status]}.`);
      },
    );
  }

  function startMove(status: Status) {
    if (status === "APPROVED") return setApproving(true);
    if (status !== "IN_REVIEW" && !window.confirm(`Move this request to ${STATUS_LABELS[status]}? This cannot be undone.`)) return;
    move(status);
  }

  function submitApproval(e: React.FormEvent) {
    e.preventDefault();
    move("APPROVED", {
      resolution: resolution || undefined,
      refundAmount: resolution === "REFUND" && refund !== "" ? Number(refund) : undefined,
    });
  }

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    run(
      () => api<Note>(`/api/requests/${id}/notes`, { method: "POST", body: JSON.stringify({ body: noteText }) }),
      (note) => {
        setRequest({ ...request, notes: [...request.notes, note] });
        setNoteText("");
        setNotice("Note added.");
      },
    );
  }

  function remove() {
    if (!request || !window.confirm(`Remove ${request.reference}? It will leave the desk but the record is kept.`)) return;
    run(
      () => api(`/api/requests/${id}`, { method: "DELETE" }),
      () => router.push(`/requests?removed=${request.reference}`),
    );
  }

  if (!load || load.id !== id) return <p className="py-10 text-center text-sm text-[#6b7280]">Loading request…</p>;

  if (!request) {
    return (
      <div role="alert" className="py-10 text-center">
        <p className="text-sm text-rose-800">{load.error}</p>
        <Link href="/requests" className="text-sm font-medium text-[#1a1a1a] hover:text-[#F7C52D] hover:underline">
          Back to requests
        </Link>
      </div>
    );
  }

  const moves = TRANSITIONS[request.status];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/requests" className="button-secondary w-fit gap-2 px-3 py-2 text-sm">
        <span aria-hidden="true">←</span> Back to requests
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Return request</p>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-[#1a1a1a] bg-gradient-to-r from-[#f3f4f6] to-transparent px-4 py-2 rounded-lg inline-block">
            {request.reference}
          </h1>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {notice && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      {editing ? (
        <RequestForm
          request={request}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setRequest(updated);
            setEditing(false);
            setError(undefined);
            setNotice("Details saved.");
          }}
        />
      ) : (
        <section className={card}>
          <div className="mb-5 flex items-center justify-between border-b border-[#e5e7eb] pb-3">
            <h2 className="font-bold text-[#1a1a1a]">Request details</h2>
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">Customer & item</span>
          </div>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Item label="Customer">{request.customerName}</Item>
            <Item label="Email">
              <a href={`mailto:${request.customerEmail}`} className="text-[#1a1a1a] hover:text-[#6b7280] hover:underline">
                {request.customerEmail}
              </a>
            </Item>
            <Item label="Phone">{request.customerPhone ?? "Not given"}</Item>
            <Item label="Order">{request.orderNumber}</Item>
            <Item label="Item">
              {request.itemName} <span className="text-[#6b7280]">({request.itemSku})</span>
            </Item>
            <Item label="Units">{request.quantity}</Item>
            <Item label="Reason">{REASON_LABELS[request.reason]}</Item>
            <Item label="Resolution">{request.resolution ? RESOLUTION_LABELS[request.resolution] : "Not decided"}</Item>
            {request.refundAmount !== null && <Item label="Refund amount">{formatMoney(request.refundAmount)}</Item>}
            <Item label="Created">{formatDateTime(request.createdAt)}</Item>
            <Item label="Last updated">{formatDateTime(request.updatedAt)}</Item>
          </dl>
          <div className="mt-5 border-t border-[#e5e7eb] pt-4 text-sm">
            {isLocked(request.status) ? (
              <p className="text-[#6b7280]">Customer and item details are locked now that this request is {STATUS_LABELS[request.status]}.</p>
            ) : (
              <button onClick={() => setEditing(true)} className="button-secondary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Details
              </button>
            )}
          </div>
        </section>
      )}

      <section className={card}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-[#e5e7eb] pb-3">
          <div>
            <h2 className="font-bold text-[#1a1a1a]">Next action</h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              {request.status === "IN_REVIEW"
                ? "Review is in progress. Choose an outcome for this request."
                : request.status === "APPROVED"
                  ? "The request is approved. Complete it when the resolution is finished."
                  : "Move this request forward when you are ready."}
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">{STATUS_LABELS[request.status]}</span>
        </div>
        {approving ? (
          <form onSubmit={submitApproval} className="space-y-3">
            <div className="mb-4 rounded-lg bg-gradient-to-r from-[#F7C52D]/10 to-[#f59e0b]/10 border border-[#F7C52D]/20 p-4">
              <h3 className="font-semibold text-[#1a1a1a]">Approve this request</h3>
              <p className="mt-1 text-sm text-[#6b7280]">Choose what the customer will receive. A refund also needs an amount.</p>
            </div>
            <div>
              <label htmlFor="resolution" className="mb-2 block text-sm font-semibold text-[#1a1a1a]">
                Resolution
              </label>
              <select
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution | "")}
                className="field"
                required
              >
                <option value="">Choose a resolution...</option>
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>
                    {RESOLUTION_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            {resolution === "REFUND" && (
              <div>
                <label htmlFor="refund" className="mb-2 block text-sm font-semibold text-[#1a1a1a]">
                  Refund amount (INR)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-4 text-base font-bold text-[#1a1a1a]" aria-hidden="true">
                    ₹
                  </span>
                  <input
                    id="refund"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={refund}
                    onChange={(e) => setRefund(e.target.value)}
                    className="field pl-9"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="button-primary disabled:opacity-60">
                {busy ? "Approving…" : "Confirm approval"}
              </button>
              <button type="button" disabled={busy} onClick={() => setApproving(false)} className="button-secondary disabled:opacity-60">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-3">
            {moves.map((status) => (
              <button
                key={status}
                disabled={busy}
                onClick={() => startMove(status)}
                className={status === "REJECTED" ? "button-danger disabled:opacity-60" : "button-primary disabled:opacity-60"}
              >
                {MOVE_LABELS[status]}
              </button>
            ))}
            {canRemove(request.status) && (
              <button disabled={busy} onClick={remove} className="button-secondary disabled:opacity-60">
                Remove request
              </button>
            )}
            {moves.length === 0 && !canRemove(request.status) && (
              <p className="text-sm text-[#6b7280]">This request is closed. No further status changes are possible.</p>
            )}
          </div>
        )}
      </section>

      <section className={card}>
        <div className="mb-4 flex items-center justify-between border-b border-[#e5e7eb] pb-3">
          <h2 className="font-bold text-[#1a1a1a]">Notes</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">Case history</span>
        </div>
        {request.notes.length === 0 ? (
          <p className="text-sm text-[#6b7280]">No notes yet.</p>
        ) : (
          <ol className="space-y-3">
            {request.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-[#e5e7eb] bg-gradient-to-r from-[#f8f9fa] to-[#f3f4f6] px-4 py-3">
                <p className="whitespace-pre-wrap text-sm text-[#1a1a1a]">{n.body}</p>
                <p className="mt-1 text-xs text-[#6b7280]">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={addNote} className="mt-4 space-y-3">
          <label htmlFor="note" className="block text-sm font-semibold text-[#1a1a1a]">
            Add a note
          </label>
          <textarea 
            id="note" 
            value={noteText} 
            onChange={(e) => setNoteText(e.target.value)} 
            rows={3} 
            maxLength={2000} 
            className="field resize-none"
            placeholder="Enter your note here..."
          />
          <p className="text-xs text-[#6b7280]">Notes cannot be edited or deleted once saved.</p>
          <button type="submit" disabled={busy || noteText.trim() === ""} className="button-primary disabled:opacity-60">
            Add note
          </button>
        </form>
      </section>

    </div>
  );
}
