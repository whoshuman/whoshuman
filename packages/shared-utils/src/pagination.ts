import type { PageQuery, Paginated } from "@whoshuman/shared-types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function normalizePage(query: PageQuery): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  const rawPage = query.page && query.page > 0 ? query.page : 1;
  const rawLimit = query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT;
  const page = Math.max(1, Math.trunc(rawPage));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(rawLimit)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export async function paginate<T>(
  query: PageQuery,
  fns: {
    findMany: (skip: number, take: number) => Promise<T[]>;
    count: () => Promise<number>;
  }
): Promise<Paginated<T>> {
  const { page, limit, skip, take } = normalizePage(query);
  const [data, total] = await Promise.all([fns.findMany(skip, take), fns.count()]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
