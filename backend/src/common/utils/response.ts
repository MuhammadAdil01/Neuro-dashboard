import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function ok<T>(res: Response, data: T, meta?: PageMeta | Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export const created = <T>(res: Response, data: T) => ok(res, data, undefined, 201);

export const noContent = (res: Response) => res.status(204).send();
