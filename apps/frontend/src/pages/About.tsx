import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../shared/authStore";
import AboutTeam from "./AboutTeam";

function About() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <AboutTeam
      withHeader
      onClose={() => void navigate({ to: isAuthenticated ? "/lobby" : "/" })}
      backLabel={isAuthenticated ? t("friends.backToLobby") : undefined}
    />
  );
}

export default About;
