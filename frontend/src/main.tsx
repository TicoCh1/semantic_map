import React from "react";
import ReactDOM from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/app.css";
import { App } from "./App";
import { DemoErrorBoundary } from "./components/DemoErrorBoundary";
import { startDemoFrontendMonitor } from "./state/demoMonitor";
import { startMobileDiagnostics } from "./state/mobileDiagnostics";

startMobileDiagnostics();
startDemoFrontendMonitor();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DemoErrorBoundary>
      <App />
    </DemoErrorBoundary>
  </React.StrictMode>
);
