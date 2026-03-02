import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import "@/index.css";
import { ToastProvider } from "@/hooks/use-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
