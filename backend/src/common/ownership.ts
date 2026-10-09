import { ApiError } from './errors';

/**
 * Enforces record ownership on the server.
 * - record missing → 404
 * - record owned by someone else → 403 (authorization failure)
 */
export function assertOwner<T extends { userId: string | null }>(record: T | null, userId: string, resource: string): T {
  if (!record) throw ApiError.notFound(resource);
  if (record.userId !== userId) throw ApiError.forbidden(`You do not have access to this ${resource.toLowerCase()}`);
  return record;
}
