import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@whoshuman/shared-validation";
import es from "./locales/es.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

const stored = localStorage.getItem("lang");
const initialLng =
  stored && SUPPORTED_LANGUAGES.includes(stored as (typeof SUPPORTED_LANGUAGES)[number])
    ? stored
    : "es";

void i18n.use(initReactI18next).init({
  lng: initialLng,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  resources: {
    es: { translation: es },
    en: { translation: en },
    fr: { translation: fr }
  }
});

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
