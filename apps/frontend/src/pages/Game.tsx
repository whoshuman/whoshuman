import { useTranslation } from "react-i18next";

function Game() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t("game.title")}</h1>
      <p>{t("game.subtitle")}</p>
    </section>
  );
}

export default Game;
