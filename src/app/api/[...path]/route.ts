import { ApiError } from "@/lib/api-error";
import { handle } from "@/lib/errors";

// Unknown API paths get the same JSON error shape instead of Next's HTML 404 page.
const notFound = handle(async () => {
  throw new ApiError(404, "ROUTE_NOT_FOUND", "No such API endpoint.");
});

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
