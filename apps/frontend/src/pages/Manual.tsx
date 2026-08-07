import { useNavigate } from "@tanstack/react-router";

import { useAuthStore } from "../shared/authStore";
import ManualPanel from "../shared/ManualPanel";

function Manual() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <ManualPanel
      withHeader
      onClose={() => void navigate({ to: isAuthenticated ? "/lobby" : "/" })}
    />
  );
}

export default Manual;
