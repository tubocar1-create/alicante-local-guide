import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ThreadView } from "@/components/coord/ThreadView";

export const Route = createFileRoute("/threads/$id")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Conversación" }, { name: "robots", content: "noindex" }] }),
  component: UserThreadPage,
});

function UserThreadPage() {
  const { id } = Route.useParams();
  const { token } = Route.useSearch();
  return (
    <div className="flex h-svh flex-col">
      <Link to="/threads" className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground">
        <ChevronLeft className="h-3 w-3" /> Volver
      </Link>
      <div className="flex-1 overflow-hidden">
        <ThreadView threadId={id} role="user" accessToken={token} />
      </div>
    </div>
  );
}
