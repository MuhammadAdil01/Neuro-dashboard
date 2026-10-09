/**
 * Seeds required reference data (roles, admin account, global categories, system settings).
 * With SEED_DEMO=true it also creates a demo user with a few weeks of realistic history,
 * useful for presentations and screenshots. Safe to run multiple times.
 */
import 'dotenv/config';
import { PrismaClient, type MoodLevel, type TaskPriority, type TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const GLOBAL_CATEGORIES = [
  { name: 'Work', color: '#6366f1' },
  { name: 'Study', color: '#0ea5e9' },
  { name: 'Personal', color: '#10b981' },
  { name: 'Health', color: '#f43f5e' },
  { name: 'Finance', color: '#f59e0b' },
  { name: 'Errands', color: '#8b5cf6' },
];

const DEFAULT_SETTINGS: Record<string, unknown> = {
  allowRegistration: true,
  maintenanceMode: false,
  announcement: '',
  defaultFocusMinutes: 25,
  maxTasksPerUser: 5000,
};

async function seedBase() {
  for (const [name, description] of [
    ['ADMIN', 'Platform administrator'],
    ['USER', 'Normal user'],
  ] as const) {
    await prisma.role.upsert({ where: { name }, create: { name, description }, update: {} });
  }

  for (const c of GLOBAL_CATEGORIES) {
    const exists = await prisma.category.findFirst({ where: { userId: null, name: c.name } });
    if (!exists) await prisma.category.create({ data: c });
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value: value as never }, update: {} });
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@neurotask.app').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        name: process.env.SEED_ADMIN_NAME ?? 'NeuroTask Admin',
        passwordHash: await bcrypt.hash(password, 12),
        roleId: adminRole.id,
        settings: { create: {} },
      },
    });
    console.info(`Admin created: ${email}`);
  } else {
    console.info(`Admin already exists: ${email}`);
  }
}

const daysAgo = (n: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return n >= 0 && d > new Date() ? new Date(Date.now() - 60_000) : d; // history never lies in the future
};
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

async function seedDemo() {
  const email = 'demo@neurotask.app';
  if (await prisma.user.findUnique({ where: { email } })) {
    console.info('Demo user already exists, skipping demo data');
    return;
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'USER' } });
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Demo Student',
      passwordHash: await bcrypt.hash('Demo@12345', 12),
      roleId: role.id,
      createdAt: daysAgo(60),
      lastLoginAt: new Date(),
      settings: { create: {} },
    },
  });
  const cats = await prisma.category.findMany({ where: { userId: null } });
  const cat = (name: string) => cats.find((c) => c.name === name)?.id;

  const fyp = await prisma.project.create({
    data: { userId: user.id, name: 'Final Year Project', description: 'NeuroTask Dashboard development and documentation', color: '#6366f1', dueDate: daysAgo(-30), createdAt: daysAgo(45) },
  });
  const exams = await prisma.project.create({
    data: { userId: user.id, name: 'Semester Exams', description: 'Revision plan for finals', color: '#0ea5e9', dueDate: daysAgo(-14), createdAt: daysAgo(30) },
  });

  const titles: [string, string | undefined, string | undefined][] = [
    ['Write SRS document', fyp.id, 'Study'], ['Design ERD', fyp.id, 'Study'], ['Set up Supabase project', fyp.id, 'Work'],
    ['Implement authentication', fyp.id, 'Work'], ['Build task CRUD API', fyp.id, 'Work'], ['Create dashboard UI', fyp.id, 'Work'],
    ['Write API documentation', fyp.id, 'Study'], ['Prepare presentation slides', fyp.id, 'Study'], ['Record demo video', fyp.id, 'Work'],
    ['Revise Operating Systems', exams.id, 'Study'], ['Practice DB normalization', exams.id, 'Study'], ['Past papers: Networks', exams.id, 'Study'],
    ['Solve algorithms worksheet', exams.id, 'Study'], ['Gym session', undefined, 'Health'], ['Pay electricity bill', undefined, 'Finance'],
    ['Buy groceries', undefined, 'Errands'], ['Call family', undefined, 'Personal'], ['Read 20 pages', undefined, 'Personal'],
    ['Morning run', undefined, 'Health'], ['Update CV', undefined, 'Work'], ['Plan next week', undefined, 'Personal'],
    ['Review pull requests', fyp.id, 'Work'], ['Fix responsive layout bugs', fyp.id, 'Work'], ['Write unit tests', fyp.id, 'Work'],
  ];
  const priorities: TaskPriority[] = ['HIGH', 'MEDIUM', 'MEDIUM', 'LOW'];

  for (let i = 0; i < titles.length; i++) {
    const [title, projectId, category] = titles[i];
    const createdDaysAgo = Math.floor(Math.random() * 40) + 3;
    const done = i < 15;
    const status: TaskStatus = done ? 'COMPLETED' : i % 3 === 0 ? 'IN_PROGRESS' : 'TODO';
    const completedDaysAgo = done ? Math.floor(Math.random() * Math.min(createdDaysAgo, 30)) : null;
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title,
        projectId,
        categoryId: category ? cat(category) : undefined,
        priority: pick(priorities),
        status,
        createdAt: daysAgo(createdDaysAgo),
        completedAt: completedDaysAgo !== null ? daysAgo(completedDaysAgo, 16) : null,
        dueDate: done ? daysAgo(completedDaysAgo! - 1, 18) : daysAgo(-(i % 9) + 1, 17),
      },
    });
    // Matching audit entries so the dashboard's recent-activity feed has history
    await prisma.activityLog.create({
      data: { userId: user.id, action: 'task.created', entityType: 'task', entityId: task.id, details: { title }, createdAt: task.createdAt },
    });
    if (task.completedAt) {
      await prisma.activityLog.create({
        data: { userId: user.id, action: 'task.completed', entityType: 'task', entityId: task.id, details: { title }, createdAt: task.completedAt },
      });
    }
  }

  // Focus sessions on most of the last 30 days
  for (let d = 0; d < 30; d++) {
    if (Math.random() < 0.25) continue;
    const count = 1 + Math.floor(Math.random() * 4);
    for (let s = 0; s < count; s++) {
      const startedAt = daysAgo(d, 9 + s * 2);
      await prisma.focusSession.create({
        data: { userId: user.id, type: 'FOCUS', status: 'COMPLETED', plannedMinutes: 25, actualSeconds: 25 * 60, startedAt, endedAt: new Date(startedAt.getTime() + 25 * 60000) },
      });
    }
  }

  const moods: MoodLevel[] = ['GREAT', 'GOOD', 'GOOD', 'OKAY', 'LOW', 'STRESSED'];
  const notesForMood: Partial<Record<MoodLevel, string>> = {
    GREAT: 'Productive day, finished everything on my list!',
    STRESSED: 'Deadline pressure for the FYP submission.',
    LOW: 'Tired, did not sleep well.',
  };
  for (let d = 0; d < 21; d++) {
    if (Math.random() < 0.2) continue;
    const mood = pick(moods);
    const entry = await prisma.moodLog.create({ data: { userId: user.id, mood, note: notesForMood[mood], loggedAt: daysAgo(d, 21) } });
    await prisma.activityLog.create({
      data: { userId: user.id, action: 'mood.logged', entityType: 'mood_log', entityId: entry.id, details: { mood }, createdAt: entry.loggedAt },
    });
  }

  await prisma.note.createMany({
    data: [
      { userId: user.id, title: 'Supervisor meeting notes', body: '- Add ERD to the SDD\n- Show RBAC in the demo\n- Prepare test report', isPinned: true },
      { userId: user.id, title: 'Exam formulas', body: 'Normalization: 1NF → 2NF → 3NF → BCNF\nDijkstra: O((V + E) log V)' },
      { userId: user.id, title: 'Ideas', body: 'AI-assisted task prioritization as a future enhancement.' },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: user.id, type: 'SYSTEM', title: 'Welcome to NeuroTask!', message: 'Your account is ready.', isRead: true, readAt: daysAgo(59) },
      { userId: user.id, type: 'TASK_COMPLETED', title: 'Nice streak!', message: 'You completed tasks on 5 days in a row.' },
    ],
  });
  console.info('Demo user created: demo@neurotask.app / Demo@12345');
}

async function main() {
  await seedBase();
  if (process.env.SEED_DEMO === 'true') await seedDemo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
