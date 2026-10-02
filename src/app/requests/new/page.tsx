import { RequestForm } from "@/components/requests/RequestForm";

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <p className="eyebrow">Returns / Intake</p>
        <h1 className="text-4xl font-bold tracking-tight text-[#1a1a1a]">New Return Request</h1>
        <p className="text-base text-[#6b7280] max-w-2xl">
          Capture customer, order, and item details to open a new return case efficiently.
        </p>
      </div>
      <RequestForm />
    </div>
  );
}
