import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ThreadView } from "@/components/coord/ThreadView";

export const Route = createFileRoute("/threads/$id")({
  head: () => ({ meta: [{ title: "Conversación" }, { name: "robots", content: "noindex" }] }),
  component: UserThreadPage,
});

function UserThreadPage() {
  const { id } = Route.useParams();
  return (
    <div className="flex h-svh flex-col">
      <Link to="/threads" className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground">
        <ChevronLeft className="h-3 w-3" /> Volver
      </Link>
      <div className="flex-1 overflow-hidden">
        <ThreadView threadId={id} role="user" />
      </div>
    </div>
  );
}
