import { useTranslation } from "react-i18next";

function NotFound() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.subtitle")}</p>
    </section>
  );
}

export default NotFound;
