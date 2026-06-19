import { useTranslation } from "react-i18next";

function Login() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t("login.title")}</h1>
      <p>{t("login.subtitle")}</p>
    </section>
  );
}

export default Login;
