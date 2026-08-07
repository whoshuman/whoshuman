import { QueryClient } from "@tanstack/react-query";

// Instancia única, en módulo propio (no en main.tsx) para poder invalidar caches
// desde código no-React — p. ej. el listener de socket de notificaciones.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1
    }
  }
});
