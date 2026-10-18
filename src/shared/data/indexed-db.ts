/** Browser-only, versioned persistence. A compare-and-swap prevents silent stale-tab overwrites. */
const DATABASE = "school-mis-demo";
const STORE = "documents";
function connect(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined")
      return reject(
        new Error("Persistent storage is unavailable in this browser."),
      );
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Cannot open storage. Check your browser storage settings.",
        ),
      );
    request.onblocked = () =>
      reject(new Error("Close other tabs to update storage."));
  });
}
export async function readWorkspaceDocument(key: string): Promise<unknown> {
  const db = await connect();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(key);
      let value: unknown;
      request.onsuccess = () => {
        value = request.result;
      };
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () =>
        reject(new Error("Could not read saved data."));
    });
  } finally {
    db.close();
  }
}
export async function writeWorkspaceDocument(
  key: string,
  value: { revision: number },
  expectedRevision: number | null,
): Promise<void> {
  const db = await connect();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const request = store.get(key);
      let conflict = false;
      request.onsuccess = () => {
        const saved = request.result;
        if (
          expectedRevision !== null &&
          (saved?.revision ?? -1) !== expectedRevision
        ) {
          conflict = true;
          tx.abort();
          return;
        }
        store.put(value, key);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            conflict
              ? "The changed in another tab. Reload before saving."
              : "Could not save data. Storage may be full or disabled.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
