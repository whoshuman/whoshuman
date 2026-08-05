import { LegalPage } from "../shared/LegalPage";

const TERMS_KEYS = [
  "acceptance",
  "nature",
  "accounts",
  "conduct",
  "enforcement",
  "availability"
] as const;

function Terms() {
  return <LegalPage namespace="terms" itemKeys={TERMS_KEYS} />;
}

export default Terms;
