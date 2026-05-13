import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ThreadView } from "@/components/coord/ThreadView";

export const Route = createFileRoute("/business/inbox/$id")({
  head: () => ({ meta: [{ title: "Conversación" }, { name: "robots", content: "noindex" }] }),
  component: BusinessThreadPage,
});

function BusinessThreadPage() {
  const { id } = Route.useParams();
  return (
    <div className="-mx-4 -my-4 flex h-[calc(100svh-7.5rem)] flex-col">
      <Link to="/business/inbox" className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground">
        <ChevronLeft className="h-3 w-3" /> Volver
      </Link>
      <div className="flex-1 overflow-hidden">
        <ThreadView threadId={id} role="business" />
      </div>
    </div>
  );
}
