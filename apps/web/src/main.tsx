import React from "react";
import ReactDOM from "react-dom/client";
import { AuthGate } from "./components/AuthGate";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
);
