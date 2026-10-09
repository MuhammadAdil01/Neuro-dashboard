import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { isProd, isTest } from '../../config/env';
import { ApiError } from '../errors';
import { formatZodError } from './validate';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) return ApiError.validation(formatZodError(err));
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Translate database constraint errors into meaningful HTTP responses
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | string | undefined) ?? 'value';
        return ApiError.conflict(`A record with this ${Array.isArray(target) ? target.join(', ') : target} already exists`);
      }
      case 'P2025':
        return ApiError.notFound();
      case 'P2003':
        return ApiError.badRequest('A referenced record does not exist');
      default:
        return new ApiError(500, 'DATABASE_ERROR', 'A database error occurred');
    }
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (e?.type === 'entity.too.large') return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  return new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.');
}

// Express identifies error handlers by their 4-argument signature
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const error = toApiError(err);

  if (error.statusCode >= 500 && !isTest) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      // Internal details are never exposed in production
      ...(!isProd && error.statusCode >= 500 && err instanceof Error ? { debug: err.message } : {}),
    },
  });
}
