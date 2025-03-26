import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import { KeyValidationProvider } from "./components/KeyValidationProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KeyValidationProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </KeyValidationProvider>
  </StrictMode>
);
