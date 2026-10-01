"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetch-json";
import {
  REASONS,
  REASON_LABELS,
  STATUSES,
  STATUS_LABELS,
  canRemove,
} from "@/lib/request-rules";
import type { RequestPage, RequestSummary } from "@/types/request";
import { formatDate } from "./format";
import { StatusBadge } from "./StatusBadge";

const SORTS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "customerName:asc", label: "Customer A to Z" },
  { value: "reference:asc", label: "Reference" },
  { value: "status:asc", label: "Status" },
];

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-2 focus:outline-brand/30";

type Result = { key: string; page?: RequestPage; error?: string };

export function RequestList() {
  const router = useRouter();
  const params = useSearchParams();
  const [result, setResult] = useState<Result>();
  const [reloads, setReloads] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  const search = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);
  const removedRef = params.get("removed");

  // Everything the server needs lives in the URL, so filters survive a reload.
  const apiQuery = new URLSearchParams();
  for (const name of ["search", "status", "reason", "sort", "order", "page"]) {
    const value = params.get(name);
    if (value) apiQuery.set(name, value);
  }
  const key = `${apiQuery.toString()}#${reloads}`;

  function updateParams(changes: Record<string, string | null>) {
    // Read the live URL: a debounced call can fire after other params changed.
    const next = new URLSearchParams(window.location.search);
    next.delete("removed");
    if (!("page" in changes)) next.delete("page");
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    router.replace(`/requests?${next.toString()}`);
  }

  // Wait for a pause in typing before searching.
  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => updateParams({ search: searchInput.trim() || null }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, search]);

  useEffect(() => {
    let current = true;
    api<RequestPage>(`/api/requests?${apiQuery.toString()}`)
      .then((page) => current && setResult({ key, page }))
      .catch((err: Error) => current && setResult({ key, error: err.message }));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function remove(request: RequestSummary) {
    if (!window.confirm(`Remove ${request.reference}? It will leave the desk but the record is kept.`)) return;
    setActionError(undefined);
    try {
      await api(`/api/requests/${request.id}`, { method: "DELETE" });
      setNotice(`${request.reference} was removed.`);
      setReloads((n) => n + 1);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  const loading = result?.key !== key;
  const page = result?.page;
  const hasFilters = ["search", "status", "reason"].some((name) => params.get(name));
  const message = notice ?? (removedRef ? `${removedRef} was removed.` : undefined);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Return requests</h1>
        {page && <p className="text-sm text-slate-600">{page.total} found</p>}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <input
          type="search"
          aria-label="Search by customer, order or reference"
          placeholder="Search customer, order or reference"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className={`${field} sm:col-span-2 lg:col-span-1`}
        />
        <select
          aria-label="Filter by status"
          value={params.get("status") ?? ""}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className={field}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by reason"
          value={params.get("reason") ?? ""}
          onChange={(e) => updateParams({ reason: e.target.value || null })}
          className={field}
        >
          <option value="">All reasons</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {REASON_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          value={`${params.get("sort") ?? "createdAt"}:${params.get("order") ?? "desc"}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(":");
            updateParams({ sort, order });
          }}
          className={field}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <p role="status" className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {message}
        </p>
      )}
      {actionError && (
        <p role="alert" className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
          {actionError}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-busy={loading}>
        <div className="hidden grid-cols-[9rem_1.2fr_7rem_1.4fr_8.5rem_7rem_7rem_7rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 lg:grid">
          <span>Reference</span>
          <span>Customer</span>
          <span>Order</span>
          <span>Item</span>
          <span>Reason</span>
          <span>Status</span>
          <span>Created</span>
          <span>Actions</span>
        </div>

        {loading && <p className="px-4 py-10 text-center text-sm text-slate-600">Loading requests…</p>}

        {!loading && result?.error && (
          <div role="alert" className="px-4 py-10 text-center">
            <p className="text-sm text-rose-800">{result.error}</p>
            <button
              onClick={() => setReloads((n) => n + 1)}
              className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && page && page.data.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="font-medium">No matching requests</p>
            <p className="mt-1 text-sm text-slate-600">
              {hasFilters ? "Try a different search or clear the filters." : "Raise the first one with New request."}
            </p>
            {hasFilters && (
              <button
                onClick={() => {
                  setSearchInput("");
                  router.replace("/requests");
                }}
                className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!loading && page && page.data.length > 0 && (
          <ul className="divide-y divide-slate-200">
            {page.data.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm lg:grid-cols-[9rem_1.2fr_7rem_1.4fr_8.5rem_7rem_7rem_7rem] lg:items-center lg:gap-y-0"
              >
                <span className="order-1 font-mono text-xs font-semibold lg:order-none">{r.reference}</span>
                <span className="order-2 justify-self-end lg:order-none lg:col-start-6 lg:row-start-1 lg:justify-self-start">
                  <StatusBadge status={r.status} />
                </span>
                <span className="order-3 col-span-2 font-medium lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-1">
                  {r.customerName}
                </span>
                <span className="order-4 col-span-2 lg:order-none lg:col-span-1 lg:col-start-4 lg:row-start-1">
                  {r.itemName} <span className="text-slate-500">×{r.quantity}</span>
                </span>
                <span className="order-5 text-slate-600 lg:order-none lg:col-start-3 lg:row-start-1">{r.orderNumber}</span>
                <span className="order-6 justify-self-end text-slate-600 lg:order-none lg:col-start-5 lg:row-start-1 lg:justify-self-start">
                  {REASON_LABELS[r.reason]}
                </span>
                <span className="order-7 text-slate-600 lg:order-none lg:col-start-7 lg:row-start-1">
                  {formatDate(r.createdAt)}
                </span>
                <span className="order-8 flex justify-end gap-3 lg:order-none lg:col-start-8 lg:row-start-1 lg:justify-start">
                  <Link href={`/requests/${r.id}`} className="font-medium text-brand hover:underline">
                    View
                  </Link>
                  {canRemove(r.status) && (
                    <button onClick={() => remove(r)} className="font-medium text-rose-700 hover:underline">
                      Remove
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page && page.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <button
            disabled={page.page <= 1}
            onClick={() => updateParams({ page: String(page.page - 1) })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium enabled:hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-slate-600">
            Page {page.page} of {page.totalPages}
          </span>
          <button
            disabled={page.page >= page.totalPages}
            onClick={() => updateParams({ page: String(page.page + 1) })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium enabled:hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
