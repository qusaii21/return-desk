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
  APPROVED: "Approve…",
  REJECTED: "Reject",
  COMPLETED: "Mark completed",
};

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-2 focus:outline-brand/30";
const card = "rounded-lg border border-slate-200 bg-white p-4 sm:p-6";

type Load = { id: string; request?: RequestDetailType; error?: string };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
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

  if (!load || load.id !== id) return <p className="py-10 text-center text-sm text-slate-600">Loading request…</p>;

  if (!request) {
    return (
      <div role="alert" className="py-10 text-center">
        <p className="text-sm text-rose-800">{load.error}</p>
        <Link href="/requests" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
          Back to requests
        </Link>
      </div>
    );
  }

  const moves = TRANSITIONS[request.status];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/requests" className="text-sm font-medium text-brand hover:underline">
        Back to requests
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-2xl font-bold tracking-tight">{request.reference}</h1>
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
          <dl className="grid gap-4 sm:grid-cols-2">
            <Item label="Customer">{request.customerName}</Item>
            <Item label="Email">
              <a href={`mailto:${request.customerEmail}`} className="text-brand hover:underline">
                {request.customerEmail}
              </a>
            </Item>
            <Item label="Phone">{request.customerPhone ?? "Not given"}</Item>
            <Item label="Order">{request.orderNumber}</Item>
            <Item label="Item">
              {request.itemName} <span className="text-slate-500">({request.itemSku})</span>
            </Item>
            <Item label="Units">{request.quantity}</Item>
            <Item label="Reason">{REASON_LABELS[request.reason]}</Item>
            <Item label="Resolution">{request.resolution ? RESOLUTION_LABELS[request.resolution] : "Not decided"}</Item>
            {request.refundAmount !== null && <Item label="Refund amount">{formatMoney(request.refundAmount)}</Item>}
            <Item label="Created">{formatDateTime(request.createdAt)}</Item>
            <Item label="Last updated">{formatDateTime(request.updatedAt)}</Item>
          </dl>
          <div className="mt-5 border-t border-slate-200 pt-4 text-sm">
            {isLocked(request.status) ? (
              <p className="text-slate-600">Customer and item details are locked now that this request is {STATUS_LABELS[request.status]}.</p>
            ) : (
              <button onClick={() => setEditing(true)} className="font-medium text-brand hover:underline">
                Edit details
              </button>
            )}
          </div>
        </section>
      )}

      <section className={card}>
        <h2 className="mb-3 font-semibold">Actions</h2>
        {approving ? (
          <form onSubmit={submitApproval} className="space-y-3">
            <div>
              <label htmlFor="resolution" className="mb-1 block text-sm font-medium">
                Resolution
              </label>
              <select
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution | "")}
                className={field}
                required
              >
                <option value="">Choose a resolution</option>
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>
                    {RESOLUTION_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            {resolution === "REFUND" && (
              <div>
                <label htmlFor="refund" className="mb-1 block text-sm font-medium">
                  Refund amount (USD)
                </label>
                <input
                  id="refund"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={refund}
                  onChange={(e) => setRefund(e.target.value)}
                  className={field}
                />
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
                {busy ? "Approving…" : "Confirm approval"}
              </button>
              <button type="button" disabled={busy} onClick={() => setApproving(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
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
                className={
                  status === "REJECTED"
                    ? "rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60"
                    : "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                }
              >
                {MOVE_LABELS[status]}
              </button>
            ))}
            {canRemove(request.status) && (
              <button disabled={busy} onClick={remove} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                Remove request
              </button>
            )}
            {moves.length === 0 && !canRemove(request.status) && (
              <p className="text-sm text-slate-600">This request is closed. No further status changes are possible.</p>
            )}
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-semibold">Notes</h2>
        {request.notes.length === 0 ? (
          <p className="text-sm text-slate-600">No notes yet.</p>
        ) : (
          <ol className="space-y-3">
            {request.notes.map((n) => (
              <li key={n.id} className="rounded-md bg-slate-50 px-3 py-2">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={addNote} className="mt-4 space-y-2">
          <label htmlFor="note" className="block text-sm font-medium">
            Add a note
          </label>
          <textarea id="note" value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} maxLength={2000} className={field} />
          <p className="text-xs text-slate-500">Notes cannot be edited or deleted once saved.</p>
          <button type="submit" disabled={busy || noteText.trim() === ""} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            Add note
          </button>
        </form>
      </section>
    </div>
  );
}
