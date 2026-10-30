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
import { appPersistence, initStores } from "./utils/db.js";
import { createSessionStore } from "./utils/sessions.js";
import { createUserStore } from "./utils/userStore.js";

// With DATABASE_URL or FIREBASE_SERVICE_ACCOUNT these records live in a real
// database and survive every deploy; otherwise in the local JSON files
// (development and tests).
initStores();

export const userStore = createUserStore(appPersistence("users", config.usersPath));
export const sessionStore = createSessionStore(appPersistence("sessions", config.sessionsPath));
export const authCodeStore = createAuthCodeStore();
