import { apiClient } from "./client";
import { CATALOG_REVALIDATE_SECONDS, serverFetchOptional } from "./server-fetch";
import type { Category } from "@/types/category";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getCategoryTree(): Promise<Category[]> {
  const res = await apiClient.get<ApiEnvelope<Category[]>>("/categories");
  return res.data.data;
}

// --- Admin ---

export interface CategoryInput {
  name: string;
  parent?: string | null;
  image?: string | null;
  description?: string | null;
  displayOrder?: number;
  isFeaturedOnHome?: boolean;
  isActive?: boolean;
}

export async function getAdminCategoryTree(): Promise<Category[]> {
  const res = await apiClient.get<ApiEnvelope<Category[]>>("/categories/admin/tree");
  return res.data.data;
}

export async function createCategory(data: CategoryInput): Promise<Category> {
  const res = await apiClient.post<ApiEnvelope<Category>>("/categories", data);
  return res.data.data;
}

export async function updateCategory(id: string, data: Partial<CategoryInput>): Promise<Category> {
  const res = await apiClient.patch<ApiEnvelope<Category>>(`/categories/${id}`, data);
  return res.data.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}

export async function reorderCategories(items: { id: string; displayOrder: number }[]): Promise<void> {
  await apiClient.patch("/categories/reorder", { items });
}

// --- Server-side (Server Components only) — see products.ts for why native
// fetch is used here instead of the axios client above.

// Optional: this feeds the nav menu, which renders on the layout and therefore
// on every page. A missing menu is a degraded page; a thrown error is no page.
//
// Revalidated on the catalog's short interval rather than hourly, despite
// categories almost never changing. The interval is not about freshness — it is
// the blast radius of a failed fetch. Falling back to an empty list means an
// empty nav gets rendered and then *cached*, so an hour-long window turned one
// unlucky moment into an hour of a site with no navigation. A few minutes
// bounds that, and re-fetching a tiny payload that often costs nothing.
export async function getCategoryTreeServer(): Promise<Category[]> {
  const body = await serverFetchOptional<ApiEnvelope<Category[]> | null>(
    '/categories',
    { revalidate: CATALOG_REVALIDATE_SECONDS },
    null,
  );
  return body?.data ?? [];
}

