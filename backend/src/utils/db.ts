/**
 * PostgreSQL document persistence — the durable home for accounts, sessions
 * and agent receipts (DATABASE_URL; any Postgres works, Neon and Supabase
 * have free tiers).
 *
 * One JSONB document per store keeps the stores' whole-document access
 * pattern (load, mutate, serialised write-back) exactly as the files did: at
 * pilot scale that is the right trade, and the schema can be normalised later
 * without touching a single store.
 */
import pg from "pg";
import { config } from "../config.js";
import { firebasePersistence, initFirebase } from "./firebase.js";
import { filePersistence, type StorePersistence } from "./persistence.js";

let pool: pg.Pool | null = null;
let ready: Promise<void> | null = null;

export function initDb(connectionString: string): void {
  pool = new pg.Pool({ connectionString, max: 4 });
  ready = pool
    .query("create table if not exists app_store (name text primary key, data jsonb not null)")
    .then(() => undefined);
}

function database(): pg.Pool {
  if (!pool) throw new Error("initDb must be called before the database store is used");
  return pool;
}

export function dbPersistence(name: string): StorePersistence {
  return {
    async read() {
      await ready;
      const res = await database().query("select data from app_store where name = $1", [name]);
      const row = res.rows[0];
      if (!row) throw Object.assign(new Error(`${name} has no data yet`), { code: "ENOENT" });
      return row.data;
    },
    async write(data) {
      await ready;
      await database().query(
        "insert into app_store (name, data) values ($1, $2) on conflict (name) do update set data = excluded.data",
        [name, JSON.stringify(data)]
      );
    }
  };
}

/**
 * The persistence for a named store: PostgreSQL when DATABASE_URL is
 * configured, Firebase Firestore when FIREBASE_SERVICE_ACCOUNT is, the JSON
 * files otherwise — so local development and tests keep using files while
 * production keeps its records across deploys.
 */
export function appPersistence(name: string, filePath: string): StorePersistence {
  const mode = initStores();
  return mode === "postgres" ? dbPersistence(name)
    : mode === "firebase" ? firebasePersistence(name)
    : filePersistence(filePath);
}

let backend: "postgres" | "firebase" | "files" | null = null;

/** Chooses and initialises the durable backend once; returns which one is live. */
export function initStores(): "postgres" | "firebase" | "files" {
  if (backend) return backend;
  if (config.databaseUrl) {
    initDb(config.databaseUrl);
    backend = "postgres";
  } else if (config.firebaseServiceAccount) {
    initFirebase(config.firebaseServiceAccount);
    backend = "firebase";
  } else {
    backend = "files";
  }
  return backend;
}
