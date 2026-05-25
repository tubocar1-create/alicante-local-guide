import { useCallback } from "react";
import { useAppAuth } from "@/hooks/useAppAuth";
import { requestAuth, type AuthPromptOptions } from "@/components/AuthPrompt";

/**
 * MODO LIBRE ACTIVO
 * --------------------------------------------------------------
 * La app permite navegación 100% anónima. `guard` ejecuta SIEMPRE
 * la acción solicitada sin lanzar ningún diálogo de registro.
 * Las métricas (interaction_events) siguen capturándose con
 * user_id = null para invitados.
 *
 * Para reactivar el gate en el futuro, restaurar:
 *   if (!isAuthenticated) { requestAuth(opts); return undefined; }
 */
export function useAuthPrompt() {
  const { isAuthenticated, user, loading } = useAppAuth();

  const guard = useCallback(
    <T,>(action: () => T | Promise<T>, _opts: AuthPromptOptions = {}): Promise<T | undefined> => {
      return Promise.resolve(action());
    },
    [],
  );

  return {
    isAuthenticated,
    isGuest: !isAuthenticated && !loading,
    user,
    loading,
    guard,
    requestAuth,
  };
}
