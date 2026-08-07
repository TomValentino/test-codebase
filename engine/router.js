const HISTORY_KEY = "routerEntryKey";
const SCROLL_STORAGE_KEY = "routerScrollPositions";

/**
 * Same layout: fetch the next static document and replace only page content.
 * Different layout: use a normal document navigation.
 */
export function startRouter(instant) {
  history.scrollRestoration = "manual";

  let currentEntryKey = ensureHistoryKey();
  let activeRequest;
  let scrollFrame;
  let storageTimer;
  const savedScroll = readSavedScroll();

  document.addEventListener("click", handleLinkClick);
  window.addEventListener("popstate", handleBackOrForward);
  window.addEventListener("scroll", scheduleScrollSave, { passive: true });
  window.addEventListener("pagehide", () => saveScroll(true));

  return Object.freeze({
    restoreInitialScroll,
    replaceCurrentUrl(nextUrl) {
      history.replaceState(history.state, "", nextUrl);
    }
  });

  /** Intercept ordinary same-origin links only. */
  function handleLinkClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target instanceof Element
      ? event.target.closest("a[href]")
      : null;
    if (!link || link.hasAttribute("download") || link.hasAttribute("data-router-reload")) return;
    if (link.target && link.target !== "_self") return;

    const nextUrl = new URL(link.href, window.location.href);
    const currentUrl = new URL(window.location.href);
    if (nextUrl.origin !== currentUrl.origin) return;

    const hashOnly =
      nextUrl.pathname === currentUrl.pathname &&
      nextUrl.search === currentUrl.search &&
      nextUrl.hash !== currentUrl.hash;

    if (hashOnly || nextUrl.href === currentUrl.href) return;

    event.preventDefault();
    navigate(nextUrl, "push");
  }

  function handleBackOrForward(event) {
    navigate(
      new URL(window.location.href),
      "pop",
      event.state?.[HISTORY_KEY]
    );
  }

  /** Fetch the next page, then replace + mount it synchronously in one task. */
  async function navigate(nextUrl, action, popEntryKey) {
    saveScroll();
    activeRequest?.abort();

    const request = new AbortController();
    activeRequest = request;

    try {
      const response = await fetch(nextUrl, {
        signal: request.signal,
        headers: { accept: "text/html" },
        credentials: "same-origin"
      });

      const isHtml = response.headers.get("content-type")?.includes("text/html");
      if (!isHtml || (response.status !== 200 && response.status !== 404)) {
        throw new Error(`Could not load ${nextUrl.pathname}`);
      }

      const nextDocument = new DOMParser().parseFromString(
        await response.text(),
        "text/html"
      );
      const currentLayout = document.querySelector("router-layout[data-layout-name]");
      const nextLayout = nextDocument.querySelector("router-layout[data-layout-name]");

      if (!currentLayout || !nextLayout) throw new Error("Missing layout boundary");
      if (currentLayout.dataset.layoutName !== nextLayout.dataset.layoutName) {
        normalNavigation(nextUrl, action);
        return;
      }

      const currentPage = currentLayout.querySelector("[data-page-content]");
      const nextPage = nextLayout.querySelector("[data-page-content]");
      if (!currentPage || !nextPage) throw new Error("Missing page boundary");

      // DOMParser scripts are inert; mount the fetched instant roots directly.
      nextPage.querySelectorAll("script[data-instant-mount]").forEach(
        (script) => script.remove()
      );

      const nextSeed = instant.readSeed(nextDocument, nextUrl);

      currentEntryKey = action === "pop"
        ? popEntryKey || ensureHistoryKey()
        : createHistoryKey();

      if (action === "push") {
        history.pushState(
          { ...history.state, [HISTORY_KEY]: currentEntryKey },
          "",
          nextUrl
        );
      }

      // Dispose the old page, then mount the fetched page while it still owns
      // its own instant-data. Moving the mounted nodes keeps their Solid events.
      instant.disposeAll(currentPage);
      window.__SEED__ = nextSeed;
      instant.mountAll(nextPage);
      currentPage.replaceChildren(...nextPage.childNodes);
      document.title = nextDocument.title;

      restoreNavigationScroll(nextUrl, action);
      window.dispatchEvent(new CustomEvent("router:navigation-complete", {
        detail: { url: nextUrl.href }
      }));
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Client navigation failed; using a normal page load.", error);
      normalNavigation(nextUrl, action);
    } finally {
      if (activeRequest === request) activeRequest = undefined;
    }
  }

  /** Reload uses the exact saved position for this history entry. */
  function restoreInitialScroll() {
    const position = savedScroll[currentEntryKey];
    if (position) window.scrollTo(position.x, position.y);
    else scrollToUrl(new URL(window.location.href));
  }

  function restoreNavigationScroll(nextUrl, action) {
    const position = action === "pop" ? savedScroll[currentEntryKey] : null;
    if (position) window.scrollTo(position.x, position.y);
    else scrollToUrl(nextUrl);
  }

  function scheduleScrollSave() {
    if (scrollFrame) return;

    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = undefined;
      saveScroll(false);

      clearTimeout(storageTimer);
      storageTimer = setTimeout(() => saveScroll(true), 120);
    });
  }

  function saveScroll(writeToStorage = true) {
    savedScroll[currentEntryKey] = {
      x: Math.round(window.scrollX),
      y: Math.round(window.scrollY)
    };

    if (!writeToStorage) return;
    try {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(savedScroll));
    } catch {
      // In-memory restoration still works when storage is blocked.
    }
  }
}

function normalNavigation(nextUrl, action) {
  if (action === "pop") window.location.reload();
  else window.location.assign(nextUrl.href);
}

function scrollToUrl(url) {
  if (url.hash) {
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (target) {
      target.scrollIntoView();
      return;
    }
  }
  window.scrollTo(0, 0);
}

function readSavedScroll() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function ensureHistoryKey() {
  const existing = history.state?.[HISTORY_KEY];
  if (existing) return existing;

  const key = createHistoryKey();
  history.replaceState(
    { ...history.state, [HISTORY_KEY]: key },
    "",
    window.location.href
  );
  return key;
}

function createHistoryKey() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
