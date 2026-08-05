import { LegalPage } from "../shared/LegalPage";

const PRIVACY_KEYS = ["collect", "purpose", "storage", "cookies", "rights", "academic"] as const;

function Privacy() {
  return <LegalPage namespace="privacy" itemKeys={PRIVACY_KEYS} />;
}

export default Privacy;
