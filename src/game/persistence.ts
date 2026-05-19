import { Platform } from "react-native";
import { deserialize, freshSave, serialize } from "../core/save";
import { SaveBlob } from "../core/types";

const STORAGE_KEY = "burnrate.save.v1";

interface Storage {
  init(): Promise<void>;
  load(): Promise<SaveBlob>;
  save(blob: SaveBlob): Promise<void>;
  wipe(): Promise<void>;
}

// ---------- Web fallback (localStorage) ----------
// expo-sqlite on web needs a WASM blob that Metro's default config doesn't
// resolve. For dev/playtesting in a browser we use localStorage; native still
// uses expo-sqlite (atomic writes, recovery-safe per GDD §16).
const webStorage: Storage = {
  async init() {},
  async load() {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return freshSave();
      return deserialize(raw);
    } catch (err) {
      throw err;
    }
  },
  async save(blob) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, serialize(blob));
    }
  },
  async wipe() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
};

// ---------- Native (expo-sqlite) ----------
function makeSqliteStorage(): Storage {
  // Lazy-require so web bundles don't try to resolve the WASM module.
  const SQLite = require("expo-sqlite") as typeof import("expo-sqlite");
  const DB_NAME = "burnrate.db";
  const TABLE = "save_state";

  let dbPromise: Promise<import("expo-sqlite").SQLiteDatabase> | null = null;
  const openDb = () => {
    if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(DB_NAME);
    return dbPromise;
  };

  return {
    async init() {
      const db = await openDb();
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS ${TABLE} (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          blob TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );`
      );
    },
    async load() {
      const db = await openDb();
      const row = await db.getFirstAsync<{ blob: string }>(
        `SELECT blob FROM ${TABLE} WHERE id = 1;`
      );
      if (!row) return freshSave();
      return deserialize(row.blob);
    },
    async save(blob) {
      const db = await openDb();
      await db.runAsync(
        `INSERT INTO ${TABLE} (id, blob, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET blob = excluded.blob, updated_at = excluded.updated_at;`,
        serialize(blob),
        Date.now()
      );
    },
    async wipe() {
      const db = await openDb();
      await db.runAsync(`DELETE FROM ${TABLE} WHERE id = 1;`);
    },
  };
}

const storage: Storage = Platform.OS === "web" ? webStorage : makeSqliteStorage();

export const initStorage = () => storage.init();
export const loadSave   = () => storage.load();
export const saveSave   = (blob: SaveBlob) => storage.save(blob);
export const wipeSave   = () => storage.wipe();
