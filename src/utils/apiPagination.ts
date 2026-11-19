export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  hasExplicitPagination: boolean;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function parsePaginationParams(
  query: Record<string, unknown> = {},
  options: { defaultLimit?: number; maxLimit?: number } = {}
): PaginationParams {
  const defaultLimit = options.defaultLimit ?? 50;
  const maxLimit = options.maxLimit ?? 100;

  const hasExplicitPage = query.page !== undefined && query.page !== '';
  const hasExplicitLimit = query.limit !== undefined && query.limit !== '';

  const parsedPage = Number.parseInt(String(query.page ?? '1'), 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const parsedLimit = Number.parseInt(String(query.limit ?? String(defaultLimit)), 10);
  const clampedLimit = Number.isFinite(parsedLimit) && parsedLimit >= 1
    ? Math.min(parsedLimit, maxLimit)
    : defaultLimit;

  return {
    page,
    limit: clampedLimit,
    offset: (page - 1) * clampedLimit,
    hasExplicitPagination: hasExplicitPage || hasExplicitLimit,
  };
}

export function paginateArray<T>(
  items: T[],
  page: number = 1,
  limit: number = 50
): { items: T[]; pagination: PaginationMetadata } {
  const safeLimit = Math.max(1, Math.floor(limit));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.max(1, Math.min(Math.floor(page), totalPages));
  const start = (safePage - 1) * safeLimit;
  const sliced = items.slice(start, start + safeLimit);

  return {
    items: sliced,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    },
  };
}

export function isValidEmailAddress(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function isValidHttpUrlStrict(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
