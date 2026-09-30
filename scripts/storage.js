let connection;
export function db() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('zweenotes-library', 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('courses', { keyPath: 'id' });
      for (const name of ['sources', 'sheets', 'chunks']) {
        const store = database.createObjectStore(name, { keyPath: 'id' });
        store.createIndex('courseId', 'courseId');
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = null; };
      resolve(request.result);
    };
    request.onblocked = () => { connection = null; reject(new Error('Close other ZweeNotes tabs and reopen the library to complete the storage update.')); };
    request.onerror = () => { connection = null; reject(new Error('Could not open the local course library.')); };
  });
  return connection;
}

export async function put(storeName, value) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(new Error('Could not save locally. Your browser storage may be full.'));
    transaction.onabort = () => reject(new Error('Local save was interrupted. Reopen ZweeNotes and try again.'));
  });
}

export async function get(storeName, id) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName).objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function list(storeName, courseId) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const store = database.transaction(storeName).objectStore(storeName);
    const request = courseId ? store.index('courseId').getAll(courseId) : store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeSource(sourceId, courseId) {
  const chunks = await list('chunks', courseId);
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sources', 'chunks'], 'readwrite');
    transaction.objectStore('sources').delete(sourceId);
    for (const chunk of chunks) if (chunk.sourceId === sourceId) transaction.objectStore('chunks').delete(chunk.id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function ensureCourse(context) {
  const id = `nus:${context.courseId}`;
  const existing = await get('courses', id);
  return put('courses', { ...existing, id, name: context.courseName || existing?.name || `NUS course ${context.courseId}`, canvasId: context.courseId, troubleTopics: existing?.troubleTopics || [], updatedAt: Date.now() });
}
