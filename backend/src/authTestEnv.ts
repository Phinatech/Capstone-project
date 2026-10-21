/**
 * Test-only environment, applied before `config.ts` is evaluated.
 *
 * `config.ts` reads `process.env` once at module load, and ES imports are
 * evaluated before the importing module's own body — so setting these in the
 * test file itself would be far too late. Importing this *first* means the
 * paths resolve into a temporary directory instead of the real one.
 *
 * That matters more than tidiness: without it, running the test suite would
 * seed demo accounts and write sessions into `backend/data/users.json` and
 * `sessions.json`, quietly mutating the state the demo runs on.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TEST_TMP_DIR = mkdtempSync(join(tmpdir(), 'cover-auth-'));

process.env.USERS_PATH = join(TEST_TMP_DIR, 'users.json');
process.env.SESSIONS_PATH = join(TEST_TMP_DIR, 'sessions.json');
process.env.AGENT_SALES_PATH = join(TEST_TMP_DIR, 'agent-sales.json');
process.env.SESSION_COOKIE_NAME = 'test_session';
process.env.SECURE_COOKIES = 'false';

// Seed the demo accounts so "sign in as Fatima" behaves the same as it does
// when the app is running for real.
process.env.AUTH_DEMO_ACCOUNTS = 'true';
// Codes come back in the response so the verification flow can be exercised
// end to end without a mail service.
process.env.AUTH_DEMO_CODES = 'true';

// A client id makes `/auth/google` reach the verifier; the verifier itself is
// injected with a fixture, so nothing here contacts Google.
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
// No secret: `/auth/register` skips the Turnstile branch rather than failing
// every registration on an unreachable Cloudflare check.
process.env.TURNSTILE_SECRET_KEY = '';
