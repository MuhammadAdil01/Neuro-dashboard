import type { Role, User, UserSettings } from '@prisma/client';

type UserWithRole = User & { role: Role; settings?: UserSettings | null };

/** Public user shape — password hash and token version are never returned. */
export function serializeUser(user: UserWithRole) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    status: user.status,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...(user.settings !== undefined ? { settings: user.settings ? serializeSettings(user.settings) : null } : {}),
  };
}

export function serializeSettings(s: UserSettings) {
  const { id: _id, userId: _userId, createdAt: _c, ...rest } = s;
  return rest;
}
