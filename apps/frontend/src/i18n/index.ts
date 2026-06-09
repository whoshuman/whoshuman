import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

void i18n.use(initReactI18next).init({
  lng: localStorage.getItem("lang") ?? "es",
  fallbackLng: "en",
  resources: {
    es: { translation: es },
    en: { translation: en },
    fr: { translation: fr }
  }
});

export default i18n;
