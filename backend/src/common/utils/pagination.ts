import { z } from 'zod';
import type { PageMeta } from './response';

export const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export function pageArgs(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
