import { Router } from 'express';
import { authenticate, requireAdmin } from './common/middleware/auth';
import { maintenanceGuard } from './common/middleware/maintenance';
import adminRoutes from './modules/admin/admin.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import authRoutes from './modules/auth/auth.routes';
import categoryRoutes from './modules/categories/categories.routes';
import exportRoutes from './modules/export/export.routes';
import focusRoutes from './modules/focus/focus.routes';
import moodRoutes from './modules/mood/mood.routes';
import noteRoutes from './modules/notes/notes.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import projectRoutes from './modules/projects/projects.routes';
import publicRoutes from './modules/public/public.routes';
import taskRoutes from './modules/tasks/tasks.routes';
import userRoutes from './modules/users/users.routes';

/** /api/v1 router. Every module below `protectedApi` requires a valid session. */
export const apiV1 = Router();

apiV1.use('/auth', authRoutes);
apiV1.use('/public', publicRoutes);

const protectedApi = Router();
protectedApi.use(authenticate, maintenanceGuard);
protectedApi.use('/users', userRoutes);
protectedApi.use('/tasks', taskRoutes);
protectedApi.use('/projects', projectRoutes);
protectedApi.use('/categories', categoryRoutes);
protectedApi.use('/focus-sessions', focusRoutes);
protectedApi.use('/moods', moodRoutes);
protectedApi.use('/notes', noteRoutes);
protectedApi.use('/notifications', notificationRoutes);
protectedApi.use('/analytics', analyticsRoutes);
protectedApi.use('/export', exportRoutes);
protectedApi.use('/admin', requireAdmin, adminRoutes); // RBAC enforced on the server

apiV1.use(protectedApi);
