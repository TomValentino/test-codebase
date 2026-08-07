import { createInstantRuntime } from "./instant.jsx";
import { startRouter } from "./router.js";

// .instant.jsx is the only component convention. Vite discovers them here.
const modules = import.meta.glob("../src/**/*.instant.jsx", { eager: true });
const components = Object.values(modules).map((module) => module.default);

const instant = createInstantRuntime(components);
window.__INSTANT__ = instant;
window.__SEED__ = instant.readSeed(document, new URL(window.location.href));
window.__ROUTER__ = startRouter(instant);

// Set only after startup succeeds. The body has not been parsed yet.
document.documentElement.dataset.instantPending = "1";
