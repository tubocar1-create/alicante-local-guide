import { useCallback } from "react";
import { useAppAuth } from "@/hooks/useAppAuth";
import { requestAuth, type AuthPromptOptions } from "@/components/AuthPrompt";

/**
 * Hook para gatear acciones que requieren cuenta registrada.
 *
 * Modo invitado: navegación libre. Al intentar una acción persistente
 * (favoritos, historial, reservas...) se llama a `guard(fn, opts)` que:
 *  - ejecuta `fn()` si hay sesión,
 *  - o lanza el diálogo contextual de registro si es invitado.
 *
 * Ejemplo:
 *   const { isAuthenticated, guard } = useAuthPrompt();
 *   <button onClick={() => guard(saveFavorite, {
 *     feature: "favorites",
 *     message: "Crea una cuenta para guardar tus favoritos.",
 *   })}>Guardar</button>
 */
export function useAuthPrompt() {
  const { isAuthenticated, user, loading } = useAppAuth();

  const guard = useCallback(
    <T,>(action: () => T | Promise<T>, opts: AuthPromptOptions = {}): Promise<T | undefined> => {
      if (!isAuthenticated) {
        requestAuth(opts);
        return Promise.resolve(undefined);
      }
      return Promise.resolve(action());
    },
    [isAuthenticated],
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
