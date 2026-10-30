/**
 * Accounts provisioned from the environment (SEED_USERS), recreated at every
 * boot.
 *
 * Render's free plan has an ephemeral disk: a redeploy wipes the user store,
 * and accounts created through sign-up go with it. The accounts a deployment
 * actually runs with — its field agent, its farmers — belong here instead: in
 * the service's environment, never in the repository, and recreated on every
 * boot exactly like the administrator account. Ids default to `role-N` in list
 * order and stay stable across restarts, so sale receipts keep naming the same
 * farmer.
 *
 * SEED_USERS is a JSON array:
 *   [{"role":"agent","name":"Fatima Abdullahi","email":"fatima@example.com",
 *     "password":"…","phone":"+234…","lga":"Wamakko"}]
 *
 * Roles are farmer and agent only — administrators come from ADMIN_*.
 * Accounts created here are marked email-verified: the operator who provisions
 * them vouches for the address.
 */
import type { NewUser } from "./userStore.js";

export interface SeedUserInput {
  id?: string;
  role: "farmer" | "agent";
  name: string;
  email: string;
  password: string;
  phone?: string;
  lga?: string;
  title?: string;
  wallet?: string;
}

export type SeededAccount = NewUser & { password: string };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parses SEED_USERS. Invalid entries are skipped and reported so one bad
 * entry cannot keep the rest of the deployment from starting.
 */
export function parseSeedUsers(json: string): { accounts: SeededAccount[]; errors: string[] } {
  const errors: string[] = [];
  if (!json.trim()) return { accounts: [], errors };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { accounts: [], errors: ["SEED_USERS is not valid JSON"] };
  }
  if (!Array.isArray(parsed)) return { accounts: [], errors: ["SEED_USERS must be a JSON array"] };

  const accounts: SeededAccount[] = [];
  parsed.forEach((raw, index) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const role = asString(entry.role);
    const name = asString(entry.name);
    const email = asString(entry.email).toLowerCase();
    const password = asString(entry.password);
    if (role !== "farmer" && role !== "agent") {
      errors.push(`entry ${index}: role must be "farmer" or "agent" (administrators come from ADMIN_*)`);
      return;
    }
    if (!name || !email || !password) {
      errors.push(`entry ${index}: name, email and password are required`);
      return;
    }
    if (password.length < 8) {
      errors.push(`entry ${index}: password must be at least 8 characters`);
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push(`entry ${index}: "${email}" is not an email address`);
      return;
    }
    const id = asString(entry.id) || `${role}-${index + 1}`;
    accounts.push({
      id,
      role,
      name,
      email,
      phone: asString(entry.phone),
      lga: asString(entry.lga),
      title: asString(entry.title) || (role === "agent" ? "Field agent" : ""),
      // A wallet can be provisioned with the account; without one the zero
      // address marks "not attached yet" rather than inventing one.
      wallet: asString(entry.wallet) || "0x0000000000000000000000000000000000000000",
      emailVerified: true,
      provider: "password",
      password
    });
  });
  return { accounts, errors };
}
