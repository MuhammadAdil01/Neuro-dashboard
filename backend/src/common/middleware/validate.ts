import type { NextFunction, Request, Response } from 'express';
import { ZodError, z, type ZodTypeAny } from 'zod';
import { ApiError } from '../errors';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export function formatZodError(err: ZodError) {
  return err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
}

/**
 * Validates and coerces request parts. Parsed values are stored on `req.valid`
 * (Express 5 makes `req.query` read-only, so it is never overwritten).
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.valid = {
        body: schemas.body ? schemas.body.parse(req.body ?? {}) : req.body,
        query: schemas.query ? schemas.query.parse(req.query) : req.query,
        params: schemas.params ? schemas.params.parse(req.params) : req.params,
      };
      next();
    } catch (err) {
      if (err instanceof ZodError) return next(ApiError.validation(formatZodError(err)));
      next(err);
    }
  };
}

/** Typed accessors for validated input. */
export const getBody = <S extends ZodTypeAny>(req: Request, _schema: S) => req.valid!.body as z.infer<S>;
export const getQuery = <S extends ZodTypeAny>(req: Request, _schema: S) => req.valid!.query as z.infer<S>;

export const idParam = z.object({ id: z.string().uuid('Invalid id') });
export const getId = (req: Request) => (req.valid!.params as { id: string }).id;
