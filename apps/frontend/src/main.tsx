import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App.tsx";
import { QueryClientProvider } from "@tanstack/react-query";
import { installGlobalClickSound } from "./shared/clickSound";
import { queryClient } from "./shared/queryClient";
const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// Sonido de click global (un solo listener, buffer compartido decodificado una vez).
installGlobalClickSound();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
