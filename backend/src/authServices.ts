/**
 * The auth stores, constructed once.
 *
 * `api.ts` and `routes/auth.ts` both need these, and both already reach for
 * module-level singletons (`agentStore`), so the same shape is used here
 * rather than threading a factory through every route.
 *
 * Tests build their own stores against temporary files instead of importing
 * these, so they never touch the real directory.
 */
import { config } from "./config.js";
import { createAuthCodeStore } from "./utils/authCodes.js";
import { createSessionStore } from "./utils/sessions.js";
import { createUserStore } from "./utils/userStore.js";

export const userStore = createUserStore(config.usersPath);
export const sessionStore = createSessionStore(config.sessionsPath);
export const authCodeStore = createAuthCodeStore();
