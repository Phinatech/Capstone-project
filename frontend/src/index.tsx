import "./index.css";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { isStaleBuildError, reloadForNewBuild } from "./utils/staleBuild";

// Any other file the old build asks for after a deploy (Vite reports those
// here): reload into the new build rather than break.
window.addEventListener("vite:preloadError", (event) => {
  if (isStaleBuildError((event as Event & { payload?: unknown }).payload)) reloadForNewBuild();
});

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<App />);
}