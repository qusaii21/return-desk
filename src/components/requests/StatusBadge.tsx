import { STATUS_LABELS, type Status } from "@/lib/request-rules";

const styles: Record<Status, string> = {
  OPEN: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 ring-blue-200 shadow-sm",
  IN_REVIEW: "bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-800 ring-amber-200 shadow-sm",
  APPROVED: "bg-gradient-to-r from-emerald-50 to-green-100 text-emerald-800 ring-emerald-200 shadow-sm",
  REJECTED: "bg-gradient-to-r from-red-50 to-rose-100 text-red-800 ring-red-200 shadow-sm",
  COMPLETED: "bg-gradient-to-r from-gray-50 to-slate-100 text-slate-800 ring-slate-200 shadow-sm",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-all duration-200 hover:scale-105 ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
