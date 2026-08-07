/* -------------------------------------------------------------------------- */
/* Product queries                                                            */
/* -------------------------------------------------------------------------- */

const PRODUCT_SUMMARY_FIELDS = `
  id
  handle
  title
  availableForSale
  featuredImage { id url altText width height }
  priceRange { minVariantPrice { amount currencyCode } }
  options { name optionValues { name } }
`;


export const PRODUCT_HANDLES_FOR_BUILD_QUERY = `
  query ProductHandlesForBuild($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes { handle }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const PRODUCTS_FOR_BUILD_QUERY = `
  query ProductsForBuild($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "available_for_sale:true") {
      nodes { ${PRODUCT_SUMMARY_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const PRODUCT_FOR_BUILD_QUERY = `
  query ProductForBuild($handle: String!) {
    product(handle: $handle) {
      id
      handle
      title
      description
      images(first: 250) { nodes { id url altText width height } }
      selectedOrFirstAvailableVariant { id }
      variants(first: 250) {
        nodes {
          id
          title
          availableForSale
          selectedOptions { name value }
          price { amount currencyCode }
          image { id url altText width height }
        }
      }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Collection queries                                                         */
/* -------------------------------------------------------------------------- */

export const COLLECTION_HANDLES_FOR_BUILD_QUERY = `
  query CollectionHandlesForBuild($first: Int!, $after: String) {
    collections(first: $first, after: $after, sortKey: TITLE) {
      nodes { handle }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const COLLECTION_FOR_BUILD_QUERY = `
  query CollectionForBuild($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(first: $first, after: $after) {
        nodes { ${PRODUCT_SUMMARY_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Cart queries                                                               */
/* -------------------------------------------------------------------------- */

const CART_FIELDS = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    updatedAt
    totalQuantity
    cost { totalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost { totalAmount { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            id
            title
            image { url altText }
            product { handle title }
          }
        }
      }
    }
  }
`;

export const FETCH_CART_QUERY = `
  ${CART_FIELDS}
  query LiveCart($cartId: ID!) {
    cart(id: $cartId) { ...CartFields }
  }
`;

export const CREATE_CART_MUTATION = `
  ${CART_FIELDS}
  mutation CreateCartWithLine($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

export const ADD_CART_LINE_MUTATION = `
  ${CART_FIELDS}
  mutation AddLineToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

export const REMOVE_CART_LINES_MUTATION = `
  ${CART_FIELDS}
  mutation RemoveAllCartLines($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;
