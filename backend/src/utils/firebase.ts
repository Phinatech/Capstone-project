/**
 * Firebase Firestore persistence — a durable home for accounts, sessions and
 * agent receipts on Google's free Spark plan.
 *
 * Exactly one document per store (collection `app_store`, document per store
 * name) keeps the stores' whole-document access pattern identical to the file
 * implementation, so either can hold the same
 * records. Configure with FIREBASE_SERVICE_ACCOUNT, the service-account JSON
 * from the Firebase console.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "../config.js";
import { filePersistence, type StorePersistence } from "./persistence.js";

/**
 * Chooses the durable backend once: Firebase Firestore when
 * FIREBASE_SERVICE_ACCOUNT is configured, local JSON files otherwise
 * (development and tests).
 */
let backend: "firebase" | "files" | null = null;

export function initStores(): "firebase" | "files" {
  if (backend) return backend;
  if (config.firebaseServiceAccount) {
    initFirebase(config.firebaseServiceAccount);
    backend = "firebase";
  } else {
    backend = "files";
  }
  return backend;
}

/** The persistence for a named store: Firestore in production, files locally. */
export function appPersistence(name: string, filePath: string): StorePersistence {
  return initStores() === "firebase" ? firebasePersistence(name) : filePersistence(filePath);
}

export function initFirebase(serviceAccountJson: string): void {
  if (getApps().length > 0) return;
  const credentials = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  initializeApp({ credential: cert(credentials as never) });
}

/**
 * A store's data as Firestore will accept it: what JSON keeps, nothing more.
 *
 * Firestore refuses `undefined` anywhere in a document ("Cannot use
 * "undefined" as a Firestore value"), where the JSON files simply leave the
 * field out. A Google account has no password hash, so every Google sign-up
 * failed in production while working locally, and so did any save carrying an
 * empty optional field. Writing the JSON form makes both backends store
 * exactly the same thing.
 */
export function firestorePayload<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

export function firebasePersistence(name: string): StorePersistence {
  // Firestore documents must be maps, so the store's document rides in a
  // `payload` field rather than being the document itself.
  return {
    async read() {
      const snapshot = await getFirestore().collection("app_store").doc(name).get();
      const payload = snapshot.data()?.payload;
      if (!snapshot.exists || payload === undefined) {
        throw Object.assign(new Error(`${name} has no data yet`), { code: "ENOENT" });
      }
      return payload;
    },
    async write(data) {
      await getFirestore().collection("app_store").doc(name).set({ payload: firestorePayload(data) as unknown[] });
    }
  };
}
