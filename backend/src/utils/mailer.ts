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

const candidates =
  config.mailUser && config.mailPassword
    ? [
        { host: config.mailHost, port: config.mailPort, secure: config.mailPort === 465, requireTLS: config.mailPort !== 465 },
        // Some hosts (Render among them) black-hole outbound SMTP on 465,
        // hanging the request until the OS gives up. Fall back to STARTTLS on
        // 587, and never let a blocked port stall an HTTP request for minutes.
        ...(config.mailPort !== 587
          ? [{ host: config.mailHost, port: 587, secure: false, requireTLS: true }]
          : [])
      ].map((c) => ({
        ...c,
        auth: { user: config.mailUser, pass: config.mailPassword },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000
      }))
    : [];

/** True when a mail service is configured. */
export function mailConfigured(): boolean {
  return candidates.length > 0;
}

/**
 * Sends a plain-text message, trying each transport in turn; false when
 * unconfigured or every attempt failed. The fallback keeps working mail
 * working even where one SMTP port is unreachable.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  for (const options of candidates) {
    try {
      await nodemailer.createTransport(options).sendMail({ from: config.mailFrom, to, subject, text });
      if (options.port !== candidates[0]?.port) {
        console.log(`[mail] ${options.host}:${config.mailPort} was unreachable; delivered via port ${options.port}`);
      }
      return true;
    } catch (err) {
      console.error(`[mail] port ${options.port} failed for ${to}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return false;
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
