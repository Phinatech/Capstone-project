import './authTestEnv.js';
import { TEST_TMP_DIR } from './authTestEnv.js';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { sessionStore, userStore } from './authServices.js';
import { attachSession } from './middleware/auth.js';
import router from './routes/api.js';
import { config } from './config.js';
import type { Role } from './utils/userStore.js';

const app = express();
app.use(attachSession({ sessions: sessionStore, users: userStore, cookieName: config.sessionCookieName }));
app.use('/api', router);

let baseUrl = '';
let server: import('node:http').Server;
const cookies: Partial<Record<Role, string>> = {};

before(async () => {
  for (const role of ['admin', 'agent', 'farmer'] as const) {
    const user = await userStore.create(
      { role, name: `Test ${role}`, email: `${role}@directory.test`, wallet: '0x0000000000000000000000000000000000000001', provider: 'password', phone: '+2348031234567', lga: 'Wamakko', emailVerified: true },
      'Directory#2026'
    );
    const session = await sessionStore.create(user.id, role);
    cookies[role] = `${config.sessionCookieName}=${session.id}`;
  }
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(TEST_TMP_DIR, { recursive: true, force: true });
});

async function directory(role?: Role) {
  const res = await fetch(`${baseUrl}/api/users/directory`, { headers: role ? { Cookie: cookies[role]! } : {} });
  return { status: res.status, users: ((await res.json()) as { users?: Array<Record<string, unknown>> }).users ?? [] };
}

describe('the user directory', () => {
  it('is closed to visitors who are not signed in', async () => {
    assert.equal((await directory()).status, 401);
  });

  it("gives agents and farmers names, LGAs and wallets, but not other people's contact details", async () => {
    for (const role of ['agent', 'farmer'] as const) {
      const { status, users } = await directory(role);
      assert.equal(status, 200);
      for (const u of users) {
        if (u.role === role) {
          assert.equal(u.email, `${role}@directory.test`, 'your own record is complete');
          continue;
        }
        assert.equal(u.email, '');
        assert.equal(u.phone, undefined);
        assert.equal(u.lastSignInAt, undefined);
        assert.equal(typeof u.name, 'string');
        assert.equal(u.lga, 'Wamakko');
        assert.equal(typeof u.wallet, 'string');
      }
    }
  });

  it('gives the administrator everyone in full', async () => {
    const { status, users } = await directory('admin');
    assert.equal(status, 200);
    const farmer = users.find((u) => u.role === 'farmer');
    assert.equal(farmer?.email, 'farmer@directory.test');
    assert.equal(farmer?.phone, '+2348031234567');
    assert.ok(users.every((u) => !('passwordHash' in u)));
  });
});
