import { Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import LanguageSelector from "../shared/LanguageSelector";

function AppLayout() {
  const { t } = useTranslation();
  return (
    <div>
      <header>
        <nav>
          <Link to="/">{t("nav.home")}</Link>
          <Link to="/login">{t("nav.login")}</Link>
          <Link to="/register">{t("nav.register")}</Link>
          <Link to="/lobby">{t("nav.lobby")}</Link>
          <Link to="/game">{t("nav.game")}</Link>
          <Link to="/design-system">{t("nav.designSystem")}</Link>
        </nav>
        <LanguageSelector />
      </header>

      <div>
        <Outlet />
      </div>

      <footer>
        <p>{t("footer.placeholder")}</p>
      </footer>
    </div>
  );
}

export default AppLayout;
