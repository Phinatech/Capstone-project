/**
 * Where a store keeps its records.
 *
 * The stores were written against whole-document JSON files: load everything,
 * mutate, write everything back, with writes serialised by the store itself.
 * That access pattern is kept — but the document may now live in Firebase
 * Firestore, which is what lets accounts, sessions and agent receipts survive
 * the deployment platform's ephemeral disk. The file implementation remains for
 * local development and tests.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface StorePersistence {
  /** The stored document, or null when nothing has been written yet. */
  read(): Promise<unknown>;
  write(data: unknown): Promise<void>;
}

export function filePersistence(filePath: string): StorePersistence {
  return {
    async read() {
      try {
        return JSON.parse(await readFile(filePath, "utf8"));
      } catch (err) {
        // "Not found" is signalled exactly like a missing file, which every
        // store already treats as an empty store; anything else is corruption
        // and must surface, since starting over would discard real records.
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          throw Object.assign(new Error(`${filePath} has no data yet`), { code: "ENOENT" });
        }
        throw new Error(`${filePath} could not be read: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    async write(data) {
      await mkdir(dirname(filePath), { recursive: true });
      const temp = `${filePath}.tmp`;
      await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      await rename(temp, filePath);
    }
  };
}
