import { Suspense } from "react";
import { RequestList } from "@/components/requests/RequestList";

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestList />
    </Suspense>
  );
}
