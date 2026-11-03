/**
 * Outbound email for verification codes and password-reset tokens.
 *
 * Configured from the environment and defaulting to Gmail's SMTP endpoint so
 * a deployment can simply use a Google App Password: the code then arrives in
 * the recipient's inbox instead of only in the server log. With BREVO_API_KEY
 * set, mail goes through Brevo's HTTPS API instead, for hosts such as Render's
 * free plan that block SMTP. With no mail settings nothing is sent and every
 * caller falls back to logging the code.
 */
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { sendBrevoMail } from "./brevo.js";

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
  return Boolean(config.brevoApiKey) || candidates.length > 0;
}

/**
 * Sends a plain-text message, through Brevo when it is configured and
 * otherwise trying each SMTP transport in turn; false when unconfigured or
 * every attempt failed. The SMTP fallback keeps working mail working even
 * where one port is unreachable.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (config.brevoApiKey) {
    const result = await sendBrevoMail({
      apiKey: config.brevoApiKey,
      sender: { name: "Sokoto Rainfall Cover", email: config.brevoSenderEmail },
      to,
      subject,
      text
    });
    if (!result.success) console.error(`[mail] Brevo failed for ${to}: ${result.error}`);
    return result.success;
  }
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

export type MailLanguage = "en" | "ha" | "fr";

/** The language a request asked its email in; English for anything else. */
export function mailLanguage(value: unknown): MailLanguage {
  return value === "ha" || value === "fr" ? value : "en";
}

const TEMPLATES: Record<MailLanguage, {
  signature: string;
  verifySubject: string;
  verifyBody: (code: string) => string;
  resetSubject: string;
  resetBody: (token: string, link?: string) => string;
}> = {
  en: {
    signature: "Sokoto Rainfall Cover — weather-index insurance on Sepolia.",
    verifySubject: "Your verification code — Sokoto Rainfall Cover",
    verifyBody: (code) =>
      `Your verification code is: ${code}\n\nIt expires in 15 minutes. If you did not create this account, ignore this message.`,
    resetSubject: "Password reset — Sokoto Rainfall Cover",
    resetBody: (token, link) =>
      `${link ? `Open this link to choose a new password:\n${link}\n\nOr enter this token on the reset page: ` : "Use this token to choose a new password: "}${token}\n\nIt expires in 1 hour. If you did not request this, ignore this message.`
  },
  ha: {
    signature: "Sokoto Rainfall Cover — inshorar yanayin ruwan sama a Sepolia.",
    verifySubject: "Lambar tabbatarwarku — Sokoto Rainfall Cover",
    verifyBody: (code) =>
      `Lambar tabbatarwarku ita ce: ${code}\n\nZa ta ƙare cikin minti 15. Idan ba ku ne kuka buɗe wannan asusun ba, ku yi watsi da wannan saƙon.`,
    resetSubject: "Sake saita kalmar sirri — Sokoto Rainfall Cover",
    resetBody: (token, link) =>
      `${link ? `Buɗe wannan hanyar don zaɓar sabuwar kalmar sirri:\n${link}\n\nKo ku shigar da wannan lambar a shafin sake saitawa: ` : "Yi amfani da wannan lambar don zaɓar sabuwar kalmar sirri: "}${token}\n\nZa ta ƙare cikin awa 1. Idan ba ku nemi wannan ba, ku yi watsi da wannan saƙon.`
  },
  fr: {
    signature: "Sokoto Rainfall Cover — assurance indicielle météo sur Sepolia.",
    verifySubject: "Votre code de vérification — Sokoto Rainfall Cover",
    verifyBody: (code) =>
      `Votre code de vérification est : ${code}\n\nIl expire dans 15 minutes. Si vous n’avez pas créé ce compte, ignorez ce message.`,
    resetSubject: "Réinitialisation du mot de passe — Sokoto Rainfall Cover",
    resetBody: (token, link) =>
      `${link ? `Ouvrez ce lien pour choisir un nouveau mot de passe :\n${link}\n\nOu saisissez ce code sur la page de réinitialisation : ` : "Utilisez ce code pour choisir un nouveau mot de passe : "}${token}\n\nIl expire dans 1 heure. Si vous n’avez pas fait cette demande, ignorez ce message.`
  }
};

export async function sendVerificationCode(to: string, code: string, language: MailLanguage = "en"): Promise<boolean> {
  const m = TEMPLATES[language];
  return sendMail(to, m.verifySubject, `${m.verifyBody(code)}\n\n${m.signature}`);
}

/** `link` opens the reset page with the token filled in, when the site's address is known. */
export async function sendPasswordReset(to: string, token: string, language: MailLanguage = "en", link?: string): Promise<boolean> {
  const m = TEMPLATES[language];
  return sendMail(to, m.resetSubject, `${m.resetBody(token, link)}\n\n${m.signature}`);
}
