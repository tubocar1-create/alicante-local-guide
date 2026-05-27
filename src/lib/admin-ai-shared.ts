// Shared query options and helpers for /admin/ai pages.
import { queryOptions } from "@tanstack/react-query";
import {
  getAiOverview,
  getAiTimeseries,
  listUnknownQueries,
  listSupervisionItems,
  listIntents,
  listEntities,
  getAiAnalytics,
  getAiCosts,
  listDubiousInteractions,
  listAgentConversations,
  listLearned,
} from "@/lib/admin-ai.functions";
import { ADMIN_PIN } from "@/lib/admin-shared";

const STALE_FAST = 60 * 1000; // 1 min for live queues
const STALE_SLOW = 5 * 60 * 1000; // 5 min for aggregates

export const aiOverviewQO = () =>
  queryOptions({
    queryKey: ["admin-ai", "overview"],
    queryFn: () => getAiOverview({ data: { pin: ADMIN_PIN } }),
    staleTime: STALE_SLOW,
    refetchOnWindowFocus: true,
  });

export const aiTimeseriesQO = (days = 14) =>
  queryOptions({
    queryKey: ["admin-ai", "timeseries", days],
    queryFn: () => getAiTimeseries({ data: { pin: ADMIN_PIN, days } }),
    staleTime: STALE_SLOW,
  });

export const unknownQueriesQO = (status: "pending" | "processed" | "all", search?: string) =>
  queryOptions({
    queryKey: ["admin-ai", "unknown", status, search ?? ""],
    queryFn: () =>
      listUnknownQueries({ data: { pin: ADMIN_PIN, status, search } }),
    staleTime: STALE_FAST,
  });

export const supervisionQO = (status: "pending" | "approved" | "rejected" | "all") =>
  queryOptions({
    queryKey: ["admin-ai", "supervision", status],
    queryFn: () => listSupervisionItems({ data: { pin: ADMIN_PIN, status } }),
    staleTime: STALE_FAST,
  });

export const intentsQO = () =>
  queryOptions({
    queryKey: ["admin-ai", "intents"],
    queryFn: () => listIntents({ data: { pin: ADMIN_PIN } }),
    staleTime: STALE_SLOW,
  });

export const entitiesQO = () =>
  queryOptions({
    queryKey: ["admin-ai", "entities"],
    queryFn: () => listEntities({ data: { pin: ADMIN_PIN } }),
    staleTime: STALE_SLOW,
  });

export const analyticsQO = () =>
  queryOptions({
    queryKey: ["admin-ai", "analytics"],
    queryFn: () => getAiAnalytics({ data: { pin: ADMIN_PIN } }),
    staleTime: STALE_SLOW,
  });

export const costsQO = () =>
  queryOptions({
    queryKey: ["admin-ai", "costs"],
    queryFn: () => getAiCosts({ data: { pin: ADMIN_PIN } }),
    staleTime: STALE_SLOW,
  });

export const FAILURE_REASON_LABEL: Record<string, string> = {
  NO_INTENT_MATCH: "Sin intent",
  LOW_CONFIDENCE: "Baja confianza",
  EMPTY_RESULTS: "Sin resultados",
  API_FAILURE: "Error API externa",
  ENTITY_AMBIGUOUS: "Entidad ambigua",
  OUT_OF_SCOPE: "Fuera de alcance",
};

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function money(n: number): string {
  return `$${n.toFixed(4)}`;
}

export const dubiousQO = (
  status: "pending" | "reviewed" | "all" = "pending",
  kind: "all" | "unresolved" | "fallback" | "low_confidence" = "all",
  search?: string,
) =>
  queryOptions({
    queryKey: ["admin-ai", "dubious", status, kind, search ?? ""],
    queryFn: () =>
      listDubiousInteractions({
        data: { pin: ADMIN_PIN, status, kind, search },
      }),
    staleTime: STALE_FAST,
  });

export const conversationsQO = (
  days = 7,
  onlyWithIssues = false,
) =>
  queryOptions({
    queryKey: ["admin-ai", "conversations", days, onlyWithIssues],
    queryFn: () =>
      listAgentConversations({
        data: { pin: ADMIN_PIN, days, only_with_issues: onlyWithIssues },
      }),
    staleTime: STALE_FAST,
  });
