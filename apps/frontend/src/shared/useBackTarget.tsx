import { useCanGoBack, useRouter } from "@tanstack/react-router";

// Volver a la pantalla anterior de verdad, no a una fija. Antes estas paginas mandaban al
// lobby a cualquiera con sesion iniciada, pero a /faq, /support, /privacy y /terms tambien
// se llega desde la home (que ya no redirige al lobby al estar autenticado), y el boton te
// dejaba en un sitio del que no venias.
//
// Si no hay historial al que volver (enlace directo, pestaña nueva) se usa el destino de
// respaldo: el lobby con sesion, la home sin ella.
export function useBackTarget(fallback: string) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return () => {
    if (canGoBack) {
      // El router tipa `history` como any en esta version, asi que se acota a lo unico que
      // se usa aqui en vez de dejar que se propague.
      const history = router.history as { back: () => void };
      history.back();
      return;
    }
    void router.navigate({ to: fallback });
  };
}
