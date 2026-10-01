"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError, api } from "@/lib/fetch-json";
import { REASONS, REASON_LABELS, type Reason } from "@/lib/request-rules";
import type { RequestDetail, RequestSummary } from "@/types/request";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-2 focus:outline-brand/30 disabled:bg-slate-100";

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
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {errors[name]?.map((message) => (
        <p key={message} className="mt-1 text-xs text-rose-700">
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
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      {error && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      <fieldset disabled={saving} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field errors={fieldErrors} name="customerName" label="Customer name">
            <input id="customerName" name="customerName" required defaultValue={request?.customerName} className={input} />
          </Field>
          <Field errors={fieldErrors} name="customerEmail" label="Customer email">
            <input id="customerEmail" name="customerEmail" type="email" required defaultValue={request?.customerEmail} className={input} />
          </Field>
          <Field errors={fieldErrors} name="customerPhone" label="Customer phone (optional)">
            <input id="customerPhone" name="customerPhone" type="tel" defaultValue={request?.customerPhone ?? ""} className={input} />
          </Field>
          <Field errors={fieldErrors} name="orderNumber" label="Order number">
            <input id="orderNumber" name="orderNumber" required defaultValue={request?.orderNumber} placeholder="ORD-1042" className={input} />
          </Field>
          <Field errors={fieldErrors} name="itemSku" label="Item SKU" hint="Identifies the item on the order.">
            <input id="itemSku" name="itemSku" required defaultValue={request?.itemSku} placeholder="HD-100" className={input} />
          </Field>
          <Field errors={fieldErrors} name="itemName" label="Item name">
            <input id="itemName" name="itemName" required defaultValue={request?.itemName} className={input} />
          </Field>
          <Field errors={fieldErrors} name="quantity" label="Units to return">
            <input id="quantity" name="quantity" type="number" min={1} max={999} step={1} required defaultValue={request?.quantity ?? 1} className={input} />
          </Field>
          <Field errors={fieldErrors} name="reason" label="Reason">
            <select id="reason" name="reason" required defaultValue={request?.reason ?? ""} className={input}>
              <option value="" disabled>
                Choose a reason
              </option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Saving…" : request ? "Save changes" : "Create request"}
        </button>
      </div>
    </form>
  );
}
