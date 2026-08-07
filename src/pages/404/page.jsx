export const layout = "site";

export function getData() {
  return { meta: { title: "Page not found | Shopify Storefront" } };
}

export default function NotFoundPage() {
  return (
    <main class="page">
      <p class="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>That page does not exist or is no longer available.</p>
      <p><a class="button" href="/">Back to products</a></p>
    </main>
  );
}
