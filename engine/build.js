import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createComponent } from "solid-js";
import { renderToString } from "solid-js/web";
import { build as viteBuild, createServer, loadEnv } from "vite";
import solid from "vite-plugin-solid";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = path.join(ROOT, "src/pages");
const LAYOUTS = path.join(ROOT, "src/layout");
const DIST = path.join(ROOT, "dist");
const GLOBAL_CSS = path.join(ROOT, "src/styles/global.css");
const COMPONENT_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const FINISH_DOCUMENT_SCRIPT =
  "window.__ROUTER__.restoreInitialScroll();window.__INSTANT__.finish()";

const env = loadEnv("production", ROOT, "VITE_");
const storeDomain = env.VITE_SHOPIFY_STORE_DOMAIN?.trim();
if (!storeDomain) throw new Error("Missing VITE_SHOPIFY_STORE_DOMAIN in .env");
const shopifyOrigin = new URL(
  storeDomain.includes("://") ? storeDomain : `https://${storeDomain}`
).origin;

/**
 * Complete static build, top to bottom.
 *
 * 1. Load pages/layouts through Vite SSR.
 * 2. Build one persistent browser bundle.
 * 3. Render every static URL with its instant JSON.
 * 4. Optionally serve dist/ for the local demo.
 */
async function buildWebsite() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  const vite = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    mode: "production",
    logLevel: "error",
    server: { middlewareMode: true },
    plugins: [solid({ ssr: true, dev: false, hot: false })],
    ssr: { noExternal: ["solid-js"] }
  });

  try {
    const instant = await vite.ssrLoadModule("/engine/instant.jsx");
    const pageFiles = await findPageFiles();
    const layouts = await loadLayouts(vite);
    const browserBundle = await buildBrowserBundle();
    const globalCss = await fs.readFile(GLOBAL_CSS, "utf8");
    const builtUrls = new Set();

    for (const pageFile of pageFiles) {
      const pageModule = await vite.ssrLoadModule(toImportPath(pageFile));
      const Page = pageModule.default;
      if (typeof Page !== "function") {
        throw new TypeError(`${toImportPath(pageFile)} must export a page component`);
      }

      const layoutName = chooseLayoutName(pageModule, layouts, pageFile);
      const Layout = layoutName ? layouts.get(layoutName) : null;
      const parameterSets = await readPageParameterSets(pageModule, pageFile);

      for (const params of parameterSets) {
        const publicUrl = createPublicUrl(pageFile, params);
        if (builtUrls.has(publicUrl)) throw new Error(`Duplicate page URL ${publicUrl}`);
        builtUrls.add(publicUrl);

        const pageData = typeof pageModule.getData === "function"
          ? await pageModule.getData({ params, pathname: publicUrl })
          : {};
        if (!pageData || typeof pageData !== "object" || Array.isArray(pageData)) {
          throw new TypeError(`${toImportPath(pageFile)} getData() must return an object`);
        }

        const { pageHtml, instantData } = renderStaticPage({
          instant,
          Page,
          Layout,
          pageData
        });
        const html = createHtmlDocument({
          title: pageData.meta?.title ?? "Storefront",
          layoutName: layoutName ?? "none",
          pageHtml,
          instantData,
          browserBundle,
          globalCss,
          shopifyOrigin,
          mountScript: instant.MOUNT_INSTANT_SCRIPT
        });

        const outputFile = outputFileForUrl(publicUrl);
        await fs.mkdir(path.dirname(outputFile), { recursive: true });
        await fs.writeFile(outputFile, html);
        console.log(`built ${publicUrl}`);
      }
    }
  } finally {
    await vite.close();
  }
}

/** Render one page while engine/instant.jsx collects seed + build props. */
function renderStaticPage({ instant, Page, Layout, pageData }) {
  instant.beginInstantBuild();

  try {
    const pageHtml = renderToString(() => {
      const page = createComponent(Page, pageData);
      return Layout
        ? createComponent(Layout, { get children() { return page; } })
        : page;
    });

    return {
      pageHtml,
      instantData: instant.finishInstantBuild()
    };
  } catch (error) {
    instant.finishInstantBuild();
    throw error;
  }
}

/** Build the one browser bundle used by every route. */
async function buildBrowserBundle() {
  const result = await viteBuild({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    plugins: [solid({ dev: false, hot: false })],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      target: "baseline-widely-available",
      minify: "oxc",
      sourcemap: false,
      write: false,
      cssCodeSplit: false,
      lib: {
        entry: path.join(ROOT, "engine/client.jsx"),
        formats: ["iife"],
        name: "StorefrontBrowser"
      }
    }
  });

  const output = (Array.isArray(result) ? result : [result])
    .flatMap((item) => item.output ?? []);
  const javascript = output.find((file) => file.type === "chunk" && file.isEntry);
  if (!javascript) throw new Error("Browser build produced no entry script");

  return {
    javascript: javascript.code.trim().replace(/<\/script/gi, "<\\/script"),
    css: output
      .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
      .map((file) => String(file.source))
      .join("\n")
  };
}

/** Discover layouts once. Pages choose one by export const layout = "name". */
async function loadLayouts(vite) {
  const layouts = new Map();

  for (const file of await findFiles(LAYOUTS)) {
    if (!COMPONENT_EXTENSIONS.some((ext) => file.endsWith(`.layout${ext}`))) continue;

    const name = path.basename(file).split(".layout.")[0];
    if (layouts.has(name)) throw new Error(`Duplicate layout "${name}"`);

    const module = await vite.ssrLoadModule(toImportPath(file));
    if (typeof module.default !== "function") {
      throw new TypeError(`${toImportPath(file)} must export a layout component`);
    }
    layouts.set(name, module.default);
  }

  return layouts;
}

function chooseLayoutName(pageModule, layouts, pageFile) {
  if (layouts.size > 1 && !pageModule.layout) {
    throw new Error(`${toImportPath(pageFile)} must export const layout`);
  }

  const name = pageModule.layout ?? (
    layouts.size === 1 ? layouts.keys().next().value : null
  );
  if (name && !layouts.has(name)) {
    throw new Error(`${toImportPath(pageFile)} uses unknown layout "${name}"`);
  }
  return name;
}

async function readPageParameterSets(pageModule, pageFile) {
  const usesParameters = path.relative(PAGES, pageFile)
    .split(path.sep)
    .some((folder) => folder.startsWith("[") && folder.endsWith("]"));

  if (!usesParameters) return [{}];

  const parameterSets = await pageModule.getAllDynamicPaths?.();
  if (!Array.isArray(parameterSets)) {
    throw new Error(`${toImportPath(pageFile)} needs getAllDynamicPaths()`);
  }
  return parameterSets;
}

async function findPageFiles() {
  const files = (await findFiles(PAGES)).filter((file) =>
    COMPONENT_EXTENSIONS.some((ext) => path.basename(file) === `page${ext}`)
  );
  if (!files.length) throw new Error("No src/pages/**/page.jsx files found");
  return files;
}

async function findFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const found = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findFiles(found));
    else files.push(found);
  }
  return files.sort();
}

function createPublicUrl(pageFile, params = {}) {
  const folders = path.relative(PAGES, path.dirname(pageFile)).split(path.sep);
  if (folders.length === 1 && ["home", "index"].includes(folders[0])) return "/";

  return `/${folders.map((folder) => {
    if (!folder.startsWith("[") || !folder.endsWith("]")) return folder;

    const name = folder.slice(1, -1);
    if (!(name in params)) throw new Error(`${toImportPath(pageFile)} is missing ${name}`);
    return encodeURIComponent(String(params[name]));
  }).join("/")}`;
}

function outputFileForUrl(publicUrl) {
  if (publicUrl === "/") return path.join(DIST, "index.html");
  if (publicUrl === "/404") return path.join(DIST, "404.html");
  return path.join(DIST, publicUrl.slice(1), "index.html");
}

function toImportPath(file) {
  return `/${path.relative(ROOT, file).split(path.sep).join("/")}`;
}

/** Add the head/CSP around one already-rendered layout. */
function createHtmlDocument({
  title,
  layoutName,
  pageHtml,
  instantData,
  browserBundle,
  globalCss,
  shopifyOrigin,
  mountScript
}) {
  const dataJson = serializeForScript(instantData);
  const css = [
    "instant-root,router-layout{display:contents}",
    "html[data-instant-pending] body{visibility:hidden!important}",
    globalCss,
    browserBundle.css
  ].filter(Boolean).join("\n").replace(/<\/style/gi, "<\\/style");

  const scriptHashes = [
    dataJson,
    browserBundle.javascript,
    mountScript,
    FINISH_DOCUMENT_SCRIPT
  ].map(createCspHash);

  const csp = [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(" ")}`,
    `style-src 'self' ${createCspHash(css)}`,
    "img-src 'self' data: https:",
    `connect-src 'self' ${shopifyOrigin}`,
    "object-src 'none'",
    "base-uri 'self'"
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="preconnect" href="https://cdn.shopify.com">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">
  <title>${escapeText(title)}</title>
  <style>${css}</style>
  <script type="application/json" id="instant-data">${dataJson}</script>
  <script>${browserBundle.javascript}</script>
</head>
<body>
<router-layout data-layout-name="${escapeAttribute(layoutName)}">
${pageHtml}
</router-layout>
<script>${FINISH_DOCUMENT_SCRIPT}</script>
</body>
</html>`;
}

function serializeForScript(value) {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) => ({
      "<": "\\u003c",
      ">": "\\u003e",
      "&": "\\u0026",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    })[character]
  );
}

function createCspHash(content) {
  return `'sha256-${createHash("sha256").update(content).digest("base64")}'`;
}

function escapeText(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

function escapeAttribute(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}

/** Tiny static server used only by npm run demo. */
function serveDist() {
  const port = Number(process.env.PORT) || 4173;
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      let file = path.join(DIST, decodeURIComponent(requestUrl.pathname));
      const stat = await fs.stat(file).catch(() => null);
      if (stat?.isDirectory()) file = path.join(file, "index.html");
      if (!stat && !path.extname(file)) file = path.join(file, "index.html");

      const content = await fs.readFile(file);
      response.writeHead(200, {
        "content-type": file.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream"
      });
      response.end(content);
    } catch {
      const notFoundFile = path.join(DIST, "404.html");
      const content = await fs.readFile(notFoundFile).catch(() => "Not found");
      response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      response.end(content);
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Try: PORT=${port + 1} npm run demo`);
      process.exitCode = 1;
      return;
    }
    throw error;
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`demo http://127.0.0.1:${port}`);
  });
}

await buildWebsite();
if (process.argv.includes("--serve")) serveDist();
