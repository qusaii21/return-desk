import { RequestForm } from "@/components/requests/RequestForm";

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">New return request</h1>
      <RequestForm />
    </div>
  );
}
