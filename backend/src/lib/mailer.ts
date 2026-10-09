import nodemailer from 'nodemailer';
import { env, isTest } from '../config/env';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export const mailEnabled = Boolean(transporter);

export async function sendMail(to: string, subject: string, text: string) {
  if (!transporter) {
    if (!isTest) console.info(`[mail disabled] To: ${to} | Subject: ${subject}\n${text}`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text });
  } catch (err) {
    // Email failure must never break the request flow (forgot-password must not leak account existence)
    console.error('Failed to send email:', (err as Error).message);
  }
}
