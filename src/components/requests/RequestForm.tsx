"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError, api } from "@/lib/fetch-json";
import { REASONS, REASON_LABELS, type Reason } from "@/lib/request-rules";
import type { RequestDetail, RequestSummary } from "@/types/request";

const input = "field disabled:bg-gray-100 disabled:cursor-not-allowed";

interface Props {
  // When given, the form edits this request instead of creating one.
  request?: RequestSummary;
  onSaved?: (updated: RequestDetail) => void;
  onCancel?: () => void;
}

function Field({
  name,
  label,
  errors,
  hint,
  children,
}: {
  name: string;
  label: string;
  errors: Record<string, string[]>;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-semibold text-[#1a1a1a]">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[#6b7280]">{hint}</p>}
      {errors[name]?.map((message) => (
        <p key={message} className="flex items-center gap-2 text-xs text-red-700">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {message}
        </p>
      ))}
    </div>
  );
}

export function RequestForm({ request, onSaved, onCancel }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const body = {
      customerName: text("customerName"),
      customerEmail: text("customerEmail"),
      customerPhone: text("customerPhone"),
      orderNumber: text("orderNumber"),
      itemSku: text("itemSku"),
      itemName: text("itemName"),
      quantity: Number(text("quantity")),
      reason: text("reason") as Reason,
    };

    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const saved = await api<RequestDetail>(request ? `/api/requests/${request.id}` : "/api/requests", {
        method: request ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      if (request) onSaved?.(saved);
      else router.push(`/requests/${saved.id}?created=1`);
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiClientError) setFieldErrors(err.fields);
      setSaving(false);
    }
  }

  return (
    <div className="panel p-8">
      <form onSubmit={submit} className="space-y-8">
        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 border-l-4 border-red-400">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-red-900">{error}</span>
          </div>
        )}

        <fieldset disabled={saving} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#F7C52D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Customer Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field errors={fieldErrors} name="customerName" label="Customer Name">
                <input 
                  id="customerName" 
                  name="customerName" 
                  required 
                  defaultValue={request?.customerName} 
                  className={input}
                  placeholder="John Doe" 
                />
              </Field>
              <Field errors={fieldErrors} name="customerEmail" label="Customer Email">
                <input 
                  id="customerEmail" 
                  name="customerEmail" 
                  type="email" 
                  required 
                  defaultValue={request?.customerEmail} 
                  className={input}
                  placeholder="john.doe@example.com" 
                />
              </Field>
              <Field errors={fieldErrors} name="customerPhone" label="Customer Phone (Optional)">
                <input 
                  id="customerPhone" 
                  name="customerPhone" 
                  type="tel" 
                  defaultValue={request?.customerPhone ?? ""} 
                  className={input}
                  placeholder="+1 (555) 123-4567" 
                />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#F7C52D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Order & Item Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field errors={fieldErrors} name="orderNumber" label="Order Number">
                <input 
                  id="orderNumber" 
                  name="orderNumber" 
                  required 
                  defaultValue={request?.orderNumber} 
                  placeholder="ORD-1042" 
                  className={input} 
                />
              </Field>
              <Field errors={fieldErrors} name="itemSku" label="Item SKU" hint="Product identifier from the order">
                <input 
                  id="itemSku" 
                  name="itemSku" 
                  required 
                  defaultValue={request?.itemSku} 
                  placeholder="HD-100" 
                  className={input} 
                />
              </Field>
              <Field errors={fieldErrors} name="itemName" label="Item Name">
                <input 
                  id="itemName" 
                  name="itemName" 
                  required 
                  defaultValue={request?.itemName} 
                  className={input}
                  placeholder="Wireless Headphones" 
                />
              </Field>
              <Field errors={fieldErrors} name="quantity" label="Units to Return">
                <input 
                  id="quantity" 
                  name="quantity" 
                  type="number" 
                  min={1} 
                  max={999} 
                  step={1} 
                  required 
                  defaultValue={request?.quantity ?? 1} 
                  className={input} 
                />
              </Field>
              <Field errors={fieldErrors} name="reason" label="Return Reason">
                <select id="reason" name="reason" required defaultValue={request?.reason ?? ""} className="field">
                  <option value="" disabled>
                    Choose a reason...
                  </option>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </fieldset>

        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6 border-t border-[#e5e7eb]">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel} 
              disabled={saving} 
              className="button-secondary disabled:opacity-50 w-full sm:w-auto"
            >
              Cancel
            </button>
          )}
          <button 
            type="submit" 
            disabled={saving} 
            className="button-primary disabled:opacity-60 w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1a1a1a]"></div>
                Saving...
              </>
            ) : (
              <>
                {request ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Request
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
