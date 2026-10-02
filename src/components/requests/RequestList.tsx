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

const field = "field";

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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">Returns / Work Queue</p>
          <h1 className="text-4xl font-bold tracking-tight text-[#1a1a1a]">Return Requests</h1>
          <p className="text-base text-[#6b7280] max-w-2xl">
            Find, review, and move customer returns through the desk efficiently and effectively.
          </p>
        </div>
        {page && (
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F7C52D] to-[#f59e0b] px-5 py-2.5 text-sm font-bold text-[#1a1a1a] shadow-lg">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{page.total} {page.total === 1 ? "Request" : "Requests"}</span>
          </div>
        )}
      </div>

      {/* Filter Controls */}
      <div className="panel p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">Search</label>
            <input
              type="search"
              aria-label="Search by customer, order or reference"
              placeholder="Customer, order, or reference..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">Status</label>
            <select
              aria-label="Filter by status"
              value={params.get("status") ?? ""}
              onChange={(e) => updateParams({ status: e.target.value || null })}
              className="field"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">Reason</label>
            <select
              aria-label="Filter by reason"
              value={params.get("reason") ?? ""}
              onChange={(e) => updateParams({ reason: e.target.value || null })}
              className="field"
            >
              <option value="">All Reasons</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">Sort By</label>
            <select
              aria-label="Sort"
              value={`${params.get("sort") ?? "createdAt"}:${params.get("order") ?? "desc"}`}
              onChange={(e) => {
                const [sort, order] = e.target.value.split(":");
                updateParams({ sort, order });
              }}
              className="field"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div role="status" className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3 border-l-4 border-emerald-400">
          <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-emerald-900">{message}</span>
        </div>
      )}
      {actionError && (
        <div role="alert" className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 border-l-4 border-red-400">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-red-900">{actionError}</span>
        </div>
      )}

      {/* Request Table */}
      <div className="panel overflow-hidden" aria-busy={loading}>
        {/* Desktop Header */}
        <div className="request-grid hidden bg-gradient-to-r from-[#f8f9fa] to-[#f3f4f6] px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#6b7280] lg:grid border-b border-[#e5e7eb]">
          <span>Reference</span>
          <span>Customer</span>
          <span>Order</span>
          <span>Item</span>
          <span>Reason</span>
          <span>Status</span>
          <span>Created</span>
          <span>Actions</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#F7C52D]"></div>
              <span className="text-[#6b7280]">Loading requests...</span>
            </div>
          </div>
        )}

        {!loading && result?.error && (
          <div role="alert" className="text-center py-16">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">Something went wrong</h3>
            <p className="text-sm text-[#6b7280] mb-4">{result.error}</p>
            <button
              onClick={() => setReloads((n) => n + 1)}
              className="button-secondary"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && page && page.data.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F7C52D]/10 mb-4">
              <svg className="w-6 h-6 text-[#F7C52D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">No matching requests</h3>
            <p className="text-sm text-[#6b7280] mb-4">
              {hasFilters ? "Try adjusting your search criteria or clear the filters." : "Get started by creating your first return request."}
            </p>
            {hasFilters && (
              <button
                onClick={() => {
                  setSearchInput("");
                  router.replace("/requests");
                }}
                className="button-secondary"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {!loading && page && page.data.length > 0 && (
          <ul className="divide-y divide-[#e5e7eb]">
            {page.data.map((r, index) => (
              <li
                key={r.id}
                className={`request-grid grid gap-x-4 gap-y-2 px-6 py-5 text-[15px] leading-relaxed hover:bg-gradient-to-r hover:from-[#F7C52D]/5 hover:to-transparent transition-all duration-200 lg:items-center lg:gap-y-0 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                }`}
              >
                <span className="order-1 whitespace-nowrap font-mono text-sm font-bold text-[#1a1a1a] bg-gradient-to-r from-[#f3f4f6] to-[#e5e7eb] px-3 py-1.5 rounded-lg lg:order-none">
                  {r.reference}
                </span>
                <span className="order-2 justify-self-end lg:order-none lg:col-start-6 lg:row-start-1 lg:justify-self-start">
                  <StatusBadge status={r.status} />
                </span>
                <span className="order-3 col-span-2 font-semibold text-[#1a1a1a] lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-1">
                  {r.customerName}
                </span>
                <span className="order-4 col-span-2 text-[#4b5563] lg:order-none lg:col-span-1 lg:col-start-4 lg:row-start-1">
                  {r.itemName} <span className="text-[#9ca3af] font-medium">×{r.quantity}</span>
                </span>
                <span className="order-5 whitespace-nowrap text-[#6b7280] font-medium lg:order-none lg:col-start-3 lg:row-start-1">
                  {r.orderNumber}
                </span>
                <span className="order-6 justify-self-end text-[#6b7280] lg:order-none lg:col-start-5 lg:row-start-1 lg:justify-self-start">
                  {REASON_LABELS[r.reason]}
                </span>
                <span className="order-7 text-[#6b7280] lg:order-none lg:col-start-7 lg:row-start-1">
                  {formatDate(r.createdAt)}
                </span>
                <div className="request-actions order-8 col-span-2 flex flex-wrap gap-2 lg:order-none lg:col-span-1 lg:col-start-8 lg:row-start-1">
                  <Link href={`/requests/${r.id}`} className="button-secondary whitespace-nowrap px-3 py-2 text-xs">
                    View Request
                  </Link>
                  {canRemove(r.status) && (
                    <button onClick={() => remove(r)} className="button-danger whitespace-nowrap px-3 py-2 text-xs">
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {page && page.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          <button
            disabled={page.page <= 1}
            onClick={() => updateParams({ page: String(page.page - 1) })}
            className="flex items-center gap-2 button-secondary px-4 py-2.5 enabled:hover:bg-[#F7C52D]/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6b7280]">
              Page <span className="font-semibold text-[#1a1a1a]">{page.page}</span> of{" "}
              <span className="font-semibold text-[#1a1a1a]">{page.totalPages}</span>
            </span>
          </div>
          
          <button
            disabled={page.page >= page.totalPages}
            onClick={() => updateParams({ page: String(page.page + 1) })}
            className="flex items-center gap-2 button-secondary px-4 py-2.5 enabled:hover:bg-[#F7C52D]/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </nav>
      )}
    </div>
  );
}
