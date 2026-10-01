import { RequestDetail } from "@/components/requests/RequestDetail";

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  return <RequestDetail id={id} justCreated={created === "1"} />;
}
