// Recreates the window.storage API that Claude artifacts provide,
// backed by the browser's localStorage, so the game code (App.jsx)
// can run unchanged outside of Claude.
window.storage = {
  async get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return { key, value: raw, shared: false };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    } catch (e) {
      return null;
    }
  },
  async delete(key) {
    try {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    } catch (e) {
      return null;
    }
  },
  async list(prefix) {
    try {
      const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    } catch (e) {
      return null;
    }
  },
};
