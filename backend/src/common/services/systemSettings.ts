import { z } from 'zod';
import { prisma } from '../../lib/prisma';

/** Platform-level settings managed from the Admin Panel. */
export const systemSettingsSchema = z.object({
  allowRegistration: z.boolean(),
  maintenanceMode: z.boolean(),
  announcement: z.string().max(300),
  defaultFocusMinutes: z.number().int().min(5).max(120),
  maxTasksPerUser: z.number().int().min(10).max(100000),
});

export type SystemSettings = z.infer<typeof systemSettingsSchema>;

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  allowRegistration: true,
  maintenanceMode: false,
  announcement: '',
  defaultFocusMinutes: 25,
  maxTasksPerUser: 5000,
};

// Settings are read on many requests (maintenance guard), so they are cached briefly in memory
const CACHE_MS = 15_000;
let cache: { value: SystemSettings; at: number } | null = null;

export async function getSystemSettings(): Promise<SystemSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const rows = await prisma.systemSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const merged = { ...DEFAULT_SYSTEM_SETTINGS, ...stored };
  const parsed = systemSettingsSchema.safeParse(merged);
  const value = parsed.success ? parsed.data : DEFAULT_SYSTEM_SETTINGS;
  cache = { value, at: Date.now() };
  return value;
}

export async function updateSystemSettings(patch: Partial<SystemSettings>, updatedBy: string) {
  cache = null;
  await prisma.$transaction(
    Object.entries(patch).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: value as never, updatedBy },
        update: { value: value as never, updatedBy },
      }),
    ),
  );
  cache = null;
  return getSystemSettings();
}
