(function (global) {
  "use strict";

  class WorkbenchStorage {
    constructor() {
      this.dbName = "editor-workbench";
      this.storeName = "keyval";
      this.dbPromise = null;
      this.fallback = false;
      this.prefix = "editor-workbench:";
    }

    async init() {
      if (!global.indexedDB) {
        this.fallback = true;
        return;
      }

      try {
        this.dbPromise = new Promise((resolve, reject) => {
          var request = global.indexedDB.open(this.dbName, 1);
          request.onupgradeneeded = () => {
            var db = request.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName);
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("Storage initialization failed."));
        });
        await this.dbPromise;
      } catch (error) {
        this.fallback = true;
      }
    }

    async get(key) {
      if (this.fallback) {
        return this.getFallback(key);
      }

      var db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        var transaction = db.transaction(this.storeName, "readonly");
        var request = transaction.objectStore(this.storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Storage read failed."));
      });
    }

    async set(key, value) {
      if (this.fallback) {
        this.setFallback(key, value);
        return;
      }

      var db = await this.dbPromise;
      await new Promise((resolve, reject) => {
        var transaction = db.transaction(this.storeName, "readwrite");
        var request = transaction.objectStore(this.storeName).put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error("Storage write failed."));
      });
    }

    async remove(key) {
      if (this.fallback) {
        this.removeFallback(key);
        return;
      }

      var db = await this.dbPromise;
      await new Promise((resolve, reject) => {
        var transaction = db.transaction(this.storeName, "readwrite");
        var request = transaction.objectStore(this.storeName).delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error("Storage remove failed."));
      });
    }

    getFallback(key) {
      try {
        var value = global.localStorage.getItem(this.prefix + key);
        return value ? JSON.parse(value) : undefined;
      } catch (error) {
        return undefined;
      }
    }

    setFallback(key, value) {
      try {
        global.localStorage.setItem(this.prefix + key, JSON.stringify(value));
      } catch (error) {
        return;
      }
    }

    removeFallback(key) {
      try {
        global.localStorage.removeItem(this.prefix + key);
      } catch (error) {
        return;
      }
    }
  }

  global.WorkbenchStorage = WorkbenchStorage;
})(window);

