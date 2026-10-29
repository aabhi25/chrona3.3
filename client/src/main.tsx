import { createRoot } from "react-dom/client";
import App from "./App";
import { installAuthFetch } from "./lib/authFetch";
import "./index.css";

installAuthFetch();

createRoot(document.getElementById("root")!).render(<App />);
