import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Conversation, MutationLog } from '../core/models';

interface ContextTrackerDB extends DBSchema {
  conversations: {
    key: string; // Canonical ID
    value: Conversation;
    indexes: {
      'by-platform': string;
      'by-updated': number;
    };
  };
  mutation_logs: {
    key: number; // Auto-increment ID
    value: MutationLog;
    indexes: {
      'by-conversation': string;
      'by-timestamp': number;
    };
  };
}

const DB_NAME = 'ai-context-tracker-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ContextTrackerDB>> | null = null;

export async function getDB(): Promise<IDBPDatabase<ContextTrackerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ContextTrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          // Initialize Version 1 Schema
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('by-platform', 'platform');
          convStore.createIndex('by-updated', 'updatedAt');

          const logStore = db.createObjectStore('mutation_logs', {
            keyPath: 'id',
            autoIncrement: true,
          });
          logStore.createIndex('by-conversation', 'conversationId');
          logStore.createIndex('by-timestamp', 'timestamp');
        }
      },
      blocked() {
        console.warn(`[IDB] Database version ${DB_VERSION} upgrade blocked by older open connections.`);
      },
      blocking() {
        console.warn(`[IDB] This connection is blocking a database upgrade. Closing...`);
        dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
      terminated() {
        console.error(`[IDB] Database connection terminated abnormally.`);
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}
