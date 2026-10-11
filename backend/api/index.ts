// Vercel serverless entry point: every request is routed here by vercel.json.
// Local development and Render still use src/server.ts (app.listen + the reminder interval).
// On Vercel, reminders are generated on demand when users fetch notifications.
import { createApp } from '../src/app';

export default createApp();
