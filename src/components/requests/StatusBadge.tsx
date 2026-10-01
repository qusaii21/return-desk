import { STATUS_LABELS, type Status } from "@/lib/request-rules";

const styles: Record<Status, string> = {
  OPEN: "bg-sky-100 text-sky-900 ring-sky-300",
  IN_REVIEW: "bg-amber-100 text-amber-900 ring-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  REJECTED: "bg-rose-100 text-rose-900 ring-rose-300",
  COMPLETED: "bg-slate-800 text-white ring-slate-800",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
