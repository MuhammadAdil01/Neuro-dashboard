import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors';
import { getSystemSettings } from '../services/systemSettings';

/** When maintenance mode is on, only admins can use the authenticated API. Must run after `authenticate`. */
export async function maintenanceGuard(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role === 'ADMIN') return next();
  try {
    const { maintenanceMode } = await getSystemSettings();
    if (maintenanceMode) {
      return next(new ApiError(503, 'MAINTENANCE', 'NeuroTask is undergoing maintenance. Please try again shortly.'));
    }
    next();
  } catch (err) {
    next(err);
  }
}
