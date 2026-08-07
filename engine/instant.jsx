import { createComponent } from "solid-js";
import { render } from "solid-js/web";

export const MOUNT_INSTANT_SCRIPT =
  "window.__INSTANT__.mount(document.currentScript.previousElementSibling)";

let buildData;
const browserDataCache = new WeakMap();

/**
 * Wrap one browser-active component.
 *
 * The .instant.jsx file is the convention. There is no component registry.
 * The state object beside the component owns its seed + page-data setup.
 */
export function instant(name, View, state = {}) {
  function InstantComponent(incomingProps) {
    if (!buildData) {
      state.setup?.(incomingProps);
      return createComponent(View, {});
    }

    const propsId = collectForBuild(
      name,
      incomingProps,
      state.seed
    );

    state.setup?.(incomingProps);

    return (
      <>
        <instant-root data-instant-name={name} data-instant-props={propsId}>
          {createComponent(View, {})}
        </instant-root>
        <script data-instant-mount innerHTML={MOUNT_INSTANT_SCRIPT}></script>
      </>
    );
  }

  InstantComponent.instantName = name;
  InstantComponent.View = View;
  InstantComponent.state = state;
  return InstantComponent;
}

/** Start collecting seed + props for one synchronous static page render. */
export function beginInstantBuild() {
  if (buildData) throw new Error("An instant build is already running");

  buildData = {
    seed: { global: {}, page: {} },
    props: {},
    nextPropsId: 0
  };
}

/** Finish the static render and return the one JSON payload for this page. */
export function finishInstantBuild() {
  if (!buildData) throw new Error("No instant build is running");

  const finished = buildData;
  buildData = undefined;
  return finished;
}

/** Browser runtime used by parser scripts and same-layout router navigation. */
export function createInstantRuntime(discoveredComponents) {
  const components = new Map();
  const cleanupByRoot = new WeakMap();

  for (const Component of discoveredComponents) {
    if (!Component?.instantName || !Component.View) {
      throw new Error("Every .instant.jsx default export must use instant()");
    }
    if (components.has(Component.instantName)) {
      throw new Error(`Duplicate instant component "${Component.instantName}"`);
    }
    components.set(Component.instantName, Component);
  }

  return Object.freeze({
    mount,
    mountAll,
    disposeAll,
    readSeed,
    finish
  });

  /** Make one static instant root correct before it can paint. */
  function mount(root) {
    if (!root || root.dataset.instantMounted === "1") return;

    const Component = components.get(root.dataset.instantName);
    if (!Component) {
      throw new Error(`Unknown instant component "${root.dataset.instantName}"`);
    }

    const props = readProps(root);

    // Build props set up normalized page data once. Seeds live separately in __SEED__.
    Component.state?.setup?.(props);

    // UI reads its central state directly; it does not receive state props.
    const target = root.ownerDocument.createElement("div");
    const dispose = render(
      () => createComponent(Component.View, {}),
      target
    );

    root.replaceChildren(...target.childNodes);
    saveCleanup(root, dispose);
    root.dataset.instantMounted = "1";
  }

  function mountAll(container) {
    container.querySelectorAll("instant-root[data-instant-name]").forEach(
      (root) => mount(root)
    );
  }

  function disposeAll(container) {
    container.querySelectorAll("instant-root[data-instant-name]").forEach(
      (root) => {
        cleanupByRoot.get(root)?.();
        cleanupByRoot.delete(root);
      }
    );
  }

  /** Resolve each declared seed source for this document. */
  function readSeed(targetDocument, targetUrl) {
    const data = readBrowserData(targetDocument);

    return {
      global: readSeedGroup(
        data.seed?.global,
        targetUrl.searchParams,
        window.__SEED__?.global
      ),
      page: readSeedGroup(data.seed?.page, targetUrl.searchParams)
    };
  }

  function finish() {
    delete document.documentElement.dataset.instantPending;
  }

  function saveCleanup(root, cleanup) {
    if (typeof cleanup === "function") cleanupByRoot.set(root, cleanup);
  }
}

/** Build-time collection for one <instant-root>. */
function collectForBuild(name, incomingProps, seed = {}) {
  const propsId = String(buildData.nextPropsId++);

  for (const [stateName, source] of Object.entries(seed)) {
    validateSeedSource(name, stateName, source);

    const scope = source.scope;
    const target = buildData.seed[scope];

    const storedSource = {
      source: source.source,
      key: source.key,
      format: source.format,
      fallback: source.fallback
    };

    const existing = target[stateName];
    if (existing && JSON.stringify(existing) !== JSON.stringify(storedSource)) {
      throw new Error(`Conflicting ${scope} instant state "${stateName}"`);
    }

    target[stateName] = storedSource;
  }

  buildData.props[propsId] = incomingProps;
  return propsId;
}

/** Read one component's normalized build props. Seed values stay in window.__SEED__. */
function readProps(root) {
  return readBrowserData(root.ownerDocument).props?.[root.dataset.instantProps] ?? {};
}

function readSeedGroup(sources = {}, query, existing = {}) {
  const values = { ...existing };

  for (const [name, source] of Object.entries(sources)) {
    if (Object.prototype.hasOwnProperty.call(values, name)) continue;

    let value = null;

    if (source.source === "urlParam") {
      value = query.has(source.key) ? query.get(source.key) : null;
    } else if (source.source === "localStorage") {
      try {
        value = localStorage.getItem(source.key);
      } catch {
        value = null;
      }
    }

    if (value === null) {
      values[name] = source.fallback;
      continue;
    }

    if (source.format === "json") {
      try {
        values[name] = JSON.parse(value);
      } catch {
        values[name] = source.fallback;
      }
      continue;
    }

    values[name] = value;
  }

  return values;
}

/** Every seed uses the same explicit contract. */
function validateSeedSource(componentName, stateName, source) {
  const label = `${componentName}.${stateName}`;

  if (!["global", "page"].includes(source.scope)) {
    throw new Error(`${label} has invalid scope "${source.scope}"`);
  }
  if (!["urlParam", "localStorage"].includes(source.source)) {
    throw new Error(`${label} has invalid source "${source.source}"`);
  }
  if (typeof source.key !== "string" || !source.key) {
    throw new Error(`${label} needs a seed key`);
  }
  if (!["text", "json"].includes(source.format)) {
    throw new Error(`${label} has invalid format "${source.format}"`);
  }
  if (!("fallback" in source)) {
    throw new Error(`${label} needs an explicit fallback`);
  }
}

function readBrowserData(targetDocument) {
  const cached = browserDataCache.get(targetDocument);
  if (cached) return cached;

  let data = {};
  try {
    data = JSON.parse(
      targetDocument.getElementById("instant-data")?.textContent || "{}"
    );
  } catch {
    data = {};
  }

  browserDataCache.set(targetDocument, data);
  return data;
}

