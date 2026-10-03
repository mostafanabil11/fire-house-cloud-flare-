import { apiClient } from "./client";
import { CATALOG_REVALIDATE_SECONDS, serverFetch, serverFetchOptional } from "./server-fetch";
import type { Product, ProductDetail, ProductListParams, Pagination } from "@/types/product";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface ApiListEnvelope<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: Pagination;
}

export async function getProducts(
  params: ProductListParams = {},
): Promise<{ items: Product[]; pagination: Pagination }> {
  const res = await apiClient.get<ApiListEnvelope<Product>>("/products", { params });
  return { items: res.data.data, pagination: res.data.pagination };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const res = await apiClient.get<ApiEnvelope<ProductDetail>>(`/products/${slug}`);
  return res.data.data;
}

export interface ProductSuggestion {
  _id: string;
  name: string;
  slug: string;
  images: string[];
  price: number;
  discountPrice: number | null;
}

export async function getSuggestions(q: string): Promise<ProductSuggestion[]> {
  const res = await apiClient.get<ApiEnvelope<ProductSuggestion[]>>("/products/suggest", { params: { q } });
  return res.data.data;
}

// --- Admin ---

export interface ProductInput {
  name: string;
  description?: string | null;
  color: string;
  styleGroup?: string | null;
  category: string;
  price: number;
  discountPrice?: number | null;
  images: string[];
  sizes: { size: ProductSizeInput["size"]; stock: number }[];
  isBestSeller?: boolean;
}

type ProductSizeInput = { size: "S" | "M" | "L" | "XL" | "2XL"; stock: number };

export interface StockMovement {
  _id: string;
  product: string;
  size: string;
  quantityChange: number;
  resultingStock: number;
  reason: string;
  reference: string | null;
  createdAt: string;
}

export async function getAdminProducts(
  params: ProductListParams = {},
): Promise<{ items: Product[]; pagination: Pagination }> {
  const res = await apiClient.get<ApiListEnvelope<Product>>("/products/admin", { params });
  return { items: res.data.data, pagination: res.data.pagination };
}

export async function getAdminProduct(id: string): Promise<Product> {
  const res = await apiClient.get<ApiEnvelope<Product>>(`/products/admin/${id}`);
  return res.data.data;
}

export async function createProduct(data: ProductInput): Promise<Product> {
  const res = await apiClient.post<ApiEnvelope<Product>>("/products", data);
  return res.data.data;
}

export async function updateProduct(id: string, data: Partial<ProductInput> & { isActive?: boolean }): Promise<Product> {
  const res = await apiClient.patch<ApiEnvelope<Product>>(`/products/${id}`, data);
  return res.data.data;
}

export async function deactivateProduct(id: string): Promise<void> {
  await apiClient.delete(`/products/${id}`);
}

export async function getStockMovements(productId: string): Promise<StockMovement[]> {
  const res = await apiClient.get<ApiEnvelope<StockMovement[]>>(`/products/${productId}/stock-movements`);
  return res.data.data;
}

export async function bulkAdjustStock(
  lines: { productId: string; size: ProductSizeInput["size"]; quantityChange: number }[],
): Promise<{ productId: string; size: string; quantityChange: number; success: boolean; error?: string }[]> {
  const res = await apiClient.post<
    ApiEnvelope<{ productId: string; size: string; quantityChange: number; success: boolean; error?: string }[]>
  >("/products/stock/bulk-adjust", { lines });
  return res.data.data;
}

// --- Server-side (Server Components only) ---
// Uses native fetch, not the axios client above, because only fetch hooks
// into Next's request-deduping and next:{revalidate} caching (axios calls
// go through Node's http module directly and bypass that layer entirely).

// Not optional: a product page has nothing to render without its product, so
// a failure here should surface rather than silently become a 404.
export async function getProductBySlugServer(slug: string): Promise<ProductDetail | null> {
  const res = await serverFetch(`/products/${slug}`, { revalidate: CATALOG_REVALIDATE_SECONDS });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch product "${slug}": ${res.status}`);
  const body: ApiEnvelope<ProductDetail> = await res.json();
  return body.data;
}

// Optional: an empty list means Next renders product pages on demand instead
// of prerendering them, which is a fine outcome for a build that can't reach
// the API — unlike failing the entire build.
//
// revalidate: 0 rather than a cached list, because this call decides which
// pages get prerendered and the per-dish fetches that follow are *not*
// optional. A cached list outliving the API it came from is the worst case:
// the build believes in slugs it can no longer fetch, generateMetadata throws,
// and the deploy dies. Asking live keeps the two in agreement — slugs only
// when the API is actually answering.
export async function getAllProductSlugsServer(): Promise<string[]> {
  const body = await serverFetchOptional<ApiListEnvelope<Product> | null>(
    '/products?limit=100',
    { revalidate: 0 },
    null,
  );
  return body?.data.map((p) => p.slug) ?? [];
}

// The whole menu, grouped the way it is read: by section, in the order the
// owner arranged them. Fetched on the server so the menu is in the first HTML
// response rather than after a client round trip — which is what makes it
// usable on a phone on mobile data.
//
// Paged rather than asked for in one shot: the API caps `limit` at 100, and a
// single oversized request is rejected outright, which silently emptied the
// whole menu. The cap below bounds the work if the menu ever grows large.
const MENU_PAGE_SIZE = 100;
const MENU_MAX_PAGES = 10;

export async function getMenuServer(): Promise<Product[]> {
  const dishes: Product[] = [];

  for (let page = 1; page <= MENU_MAX_PAGES; page += 1) {
    const body = await serverFetchOptional<ApiListEnvelope<Product> | null>(
      `/products?limit=${MENU_PAGE_SIZE}&page=${page}`,
      { revalidate: CATALOG_REVALIDATE_SECONDS },
      null,
    );
    if (!body) break;

    dishes.push(...body.data);
    if (page >= body.pagination.pages) break;
  }

  return dishes;
}

// Optional: the home page still renders without a "most ordered" row, and a
// missing one is far better than a home page that fails to render at all.
export async function getBestSellersServer(): Promise<Product[]> {
  const body = await serverFetchOptional<ApiEnvelope<Product[]> | null>(
    '/products/best-sellers',
    { revalidate: CATALOG_REVALIDATE_SECONDS },
    null,
  );
  return body?.data ?? [];
}
