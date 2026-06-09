import { useTranslation } from "react-i18next";

function Register() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t("register.title")}</h1>
      <p>{t("register.subtitle")}</p>
    </section>
  );
}

export default Register;
