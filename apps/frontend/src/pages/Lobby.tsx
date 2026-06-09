import { useTranslation } from "react-i18next";

function Lobby() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t("lobby.title")}</h1>
      <p>{t("lobby.subtitle")}</p>
    </section>
  );
}

export default Lobby;
