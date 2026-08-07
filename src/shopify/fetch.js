/*
 * The one Storefront API connection used by both the static build and browser.
 *
 * These VITE_ values are intentionally public. Shopify public Storefront tokens
 * are designed for browser requests. Never place an Admin or private token here.
 */
const storeDomain = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN?.trim();
const storefrontApiVersion =
  import.meta.env.VITE_SHOPIFY_API_VERSION?.trim() || "2026-07";
const publicStorefrontToken =
  import.meta.env.VITE_SHOPIFY_PUBLIC_STOREFRONT_TOKEN?.trim() || "";

if (!storeDomain) {
  throw new Error("Missing VITE_SHOPIFY_STORE_DOMAIN in .env");
}

export const SHOPIFY_STORE_ORIGIN = new URL(
  storeDomain.includes("://") ? storeDomain : `https://${storeDomain}`
).origin;

const shopifyGraphqlEndpoint =
  `${SHOPIFY_STORE_ORIGIN}/api/${storefrontApiVersion}/graphql.json`;

/** Send one GraphQL operation to Shopify and return its data. */
export async function fetchShopifyStorefront(query, variables = {}, options = {}) {
  const headers = { "content-type": "application/json" };

  if (publicStorefrontToken) {
    headers["X-Shopify-Storefront-Access-Token"] = publicStorefrontToken;
  }

  const requestOptions = {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  };

  // Browser cart reconciliation is non-critical, so it may request low
  // network priority. Node build requests keep the normal priority.
  if (typeof window !== "undefined" && options.priority) {
    requestOptions.priority = options.priority;
  }

  const response = await fetch(shopifyGraphqlEndpoint, requestOptions);

  if (!response.ok) {
    throw new Error(`Shopify request failed with HTTP ${response.status}`);
  }

  const responseBody = await response.json();

  if (responseBody.errors?.length) {
    throw new Error(responseBody.errors.map((error) => error.message).join("; "));
  }

  return responseBody.data;
}
