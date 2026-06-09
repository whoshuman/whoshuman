import { useTranslation } from "react-i18next";

function Home() {
  const { t } = useTranslation();
  return (
    <main>
      <section>
        <p>{t("home.credits")}</p>
        <h1>{t("home.title")}</h1>
        <p>{t("home.tagline")}</p>
      </section>
    </main>
  );
}

export default Home;
