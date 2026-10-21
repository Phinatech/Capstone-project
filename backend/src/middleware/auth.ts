/**
 * Session middleware.
 *
 * This is what "real authorization lives server-side" means in practice
 * (F-1): a request's identity is read from the httpOnly session cookie and
 * looked up in the session store, never from the request body. A client that
 * posts `{"agentId": "agent-1"}` gains nothing, because the server answers
 * with the account the session actually belongs to.
 *
 * `RequireRole` in the frontend keeps guarding routes, but only as UX — it
 * decides what to *render*, never what is permitted.
 */
import type { NextFunction, Request, Response } from "express";
import { readCookie } from "../utils/cookies.js";
import type { Session, SessionStore } from "../utils/sessions.js";
import type { PublicUser, Role, UserStore } from "../utils/userStore.js";

export interface SessionPrincipal {
  user: PublicUser;
  session: Session;
}

declare module "express-serve-static-core" {
  interface Request {
    /** Set by `attachSession`; present only for an authenticated request. */
    principal?: SessionPrincipal;
  }
}

export interface SessionDeps {
  sessions: SessionStore;
  users: UserStore;
  cookieName: string;
}

/**
 * Resolves the cookie into a principal, if there is a live session.
 *
 * Never rejects: an absent, expired, forged or swept cookie is simply an
 * anonymous request, and the endpoints that need a user say so themselves.
 */
export function attachSession({ sessions, users, cookieName }: SessionDeps) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = readCookie(req.headers.cookie, cookieName);
      if (!id) return next();
      const session = await sessions.read(id);
      if (!session) return next();
      const record = await users.findById(session.userId);
      // A session that outlives its account must not keep working.
      if (!record) return next();
      req.principal = { user: { ...record, passwordHash: undefined } as PublicUser, session };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** 401 unless the request carries a live session. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.principal) {
    res.status(401).json({ error: "Sign in to continue" });
    return;
  }
  next();
}

/**
 * 403 when the session's role is not one of `roles`.
 *
 * The role comes from the session record, which the server set at sign-in —
 * so unlike the old flow there is no localStorage override map to edit.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.principal) {
      res.status(401).json({ error: "Sign in to continue" });
      return;
    }
    if (!roles.includes(req.principal.user.role)) {
      res.status(403).json({ error: "This account does not have access to that" });
      return;
    }
    next();
  };
}
