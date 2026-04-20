import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { runVersionGuard } from "./lib/cacheReset";

(async () => {
  const reloading = await runVersionGuard();
  if (reloading) return; // Page is reloading; don't mount.
  createRoot(document.getElementById("root")!).render(<App />);
})();
