import { vi } from 'vitest';

const memoryStore: Record<string, Record<string, any>> = {
  conversations: {},
  mutation_logs: {},
};

vi.mock('../storage/db', () => {
  return {
    getDB: async () => {
      return {
        transaction: (stores: string[], mode: string) => {
          return {
            objectStore: (storeName: string) => {
              return {
                get: async (key: string) => memoryStore[storeName]?.[key] || null,
                put: async (val: any) => {
                  if (!memoryStore[storeName]) memoryStore[storeName] = {};
                  memoryStore[storeName][val.id] = val;
                },
                add: async (val: any) => {
                  if (!memoryStore[storeName]) memoryStore[storeName] = {};
                  const id = Object.keys(memoryStore[storeName]).length + 1;
                  memoryStore[storeName][id] = { ...val, id };
                },
              };
            },
            done: Promise.resolve(),
          };
        },
      };
    },
  };
});
