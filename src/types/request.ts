import type { Reason, Resolution, Status } from "@/lib/request-rules";

export interface Note {
  id: string;
  body: string;
  createdAt: string;
}

export interface RequestSummary {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  orderNumber: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  reason: Reason;
  status: Status;
  resolution: Resolution | null;
  refundAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestDetail extends RequestSummary {
  notes: Note[];
}

export interface RequestPage {
  data: RequestSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
