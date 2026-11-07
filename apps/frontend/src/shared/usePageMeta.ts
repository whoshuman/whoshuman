import { useEffect } from "react";
import { useTranslation } from "react-i18next";

// Dominio publico: canonical y og:url tienen que ser absolutos.
const SITE_URL = "https://whoshuman.es";
const SITE_NAME = "Who's Human";

// Paginas publicas que Google debe indexar (las mismas que public/sitemap.xml) y su clave
// en la seccion "seo" de los locales. El resto de rutas conocidas son privadas o de paso
// y llevan noindex; cualquier otra ruta es un 404 (nginx ya responde con ese codigo).
const INDEXABLE: Record<string, string> = {
  "/": "home",
  "/about": "about",
  "/manual": "manual",
  "/faq": "faq",
  "/support": "support",
  "/privacy": "privacy",
  "/terms": "terms"
};

const PRIVATE: Record<string, string> = {
  "/login": "login",
  "/register": "register",
  "/oauth/callback": "oauth",
  "/lobby": "lobby",
  "/game": "game",
  "/profile": "profile",
  "/friends": "friends",
  "/status": "status",
  "/design-system": "designSystem"
};

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Titulo, descripcion, canonical y robots de cada ruta. Google ejecuta el JS de la SPA y lee
 * estos valores; los rastreadores de vista previa (LinkedIn, WhatsApp...) no, y para ellos
 * quedan los de index.html, que son los de la portada.
 */
export function usePageMeta(pathname: string) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const indexKey = INDEXABLE[path];
    const key = indexKey ?? PRIVATE[path] ?? "notFound";

    const pageTitle = t(`seo.${key}.title`);
    const title = key === "home" ? pageTitle : `${pageTitle} · ${SITE_NAME}`;
    const description = t(`seo.${key}.description`, { defaultValue: t("seo.home.description") });
    const url = indexKey ? `${SITE_URL}${path === "/" ? "/" : path}` : null;

    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", indexKey ? "index, follow" : "noindex, follow");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    if (url) setMeta("property", "og:url", url);
    setCanonical(url);
  }, [pathname, t, i18n.language]);
}
