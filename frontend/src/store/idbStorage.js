import { get, set, del } from 'idb-keyval';

/**
 * Custom StateStorage implementation using idb-keyval
 */
export const idbStorage = {
  getItem: async (name) => {
    const value = await get(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  },
};
