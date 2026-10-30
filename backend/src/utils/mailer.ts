/**
 * Outbound email for verification codes and password-reset tokens.
 *
 * Configured from the environment and defaulting to Gmail's SMTP endpoint so
 * a deployment can simply use a Google App Password: the code then arrives in
 * the recipient's inbox instead of only in the server log. With no mail
 * settings nothing is sent and every caller falls back to logging the code.
 */
import nodemailer from "nodemailer";
import { config } from "../config.js";

const transport =
  config.mailUser && config.mailPassword
    ? nodemailer.createTransport({
        host: config.mailHost,
        port: config.mailPort,
        secure: config.mailPort === 465,
        auth: { user: config.mailUser, pass: config.mailPassword }
      })
    : null;

/** True when a mail service is configured. */
export function mailConfigured(): boolean {
  return transport !== null;
}

/** Sends a plain-text message; false when unconfigured or the send failed. */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!transport) return false;
  try {
    await transport.sendMail({ from: config.mailFrom, to, subject, text });
    return true;
  } catch (err) {
    console.error(`[mail] could not send to ${to}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

const SIGNATURE = "Sokoto Rainfall Cover — weather-index insurance on Sepolia.";

export async function sendVerificationCode(to: string, code: string): Promise<boolean> {
  return sendMail(
    to,
    "Your verification code — Sokoto Rainfall Cover",
    `Your verification code is: ${code}\n\nIt expires in 15 minutes. If you did not create this account, ignore this message.\n\n${SIGNATURE}`
  );
}

export async function sendPasswordReset(to: string, token: string): Promise<boolean> {
  return sendMail(
    to,
    "Password reset — Sokoto Rainfall Cover",
    `Use this token to choose a new password: ${token}\n\nIt expires in 15 minutes. If you did not request this, ignore this message.\n\n${SIGNATURE}`
  );
}
