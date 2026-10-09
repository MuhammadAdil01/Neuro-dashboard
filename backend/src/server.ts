import { createApp } from './app';
import { env } from './config/env';
import { generateTaskReminders } from './common/services/notify';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`NeuroTask API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Background job: due-soon reminders and overdue alerts (also generated on demand when users fetch notifications)
let reminderTimer: NodeJS.Timeout | undefined;
if (env.REMINDER_INTERVAL_SECONDS > 0) {
  const run = () =>
    generateTaskReminders()
      .then((n) => n && console.info(`Reminder job created ${n} notification(s)`))
      .catch((err) => console.error('Reminder job failed:', err.message));
  reminderTimer = setInterval(run, env.REMINDER_INTERVAL_SECONDS * 1000);
  setTimeout(run, 5000);
}

async function shutdown(signal: string) {
  console.info(`${signal} received, shutting down...`);
  clearInterval(reminderTimer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
