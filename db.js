/* 보면대 저장소 — 앱 화면과 서비스 워커가 함께 쓰는 IndexedDB 모듈
 *
 *  scores  : 악보 정보 { id, title, size, pages, addedAt }
 *  files   : 악보 PDF 원본 (key = 악보 id, value = Blob)
 *  folders : 폴더 { id, name, items: [악보 id...], createdAt }
 *  inbox   : 다른 앱에서 공유받아 아직 정리 안 된 PDF { name, blob, at }
 */
(function (root) {
  const DB_NAME = 'bomyeondae';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('scores')) db.createObjectStore('scores', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
        if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('inbox')) db.createObjectStore('inbox', { autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }

  function reqP(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function run(stores, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      Promise.resolve(fn(tx)).then((r) => { result = r; }, reject);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('저장에 실패했어요'));
    });
  }

  const DB = {
    open,
    getAll: (store) => run([store], 'readonly', (tx) => reqP(tx.objectStore(store).getAll())),
    get: (store, key) => run([store], 'readonly', (tx) => reqP(tx.objectStore(store).get(key))),
    put: (store, value, key) =>
      run([store], 'readwrite', (tx) => reqP(key === undefined ? tx.objectStore(store).put(value) : tx.objectStore(store).put(value, key))),
    del: (store, key) => run([store], 'readwrite', (tx) => reqP(tx.objectStore(store).delete(key))),

    /* 악보 정보와 PDF를 한 번에 저장 */
    addScore: (meta, blob) =>
      run(['scores', 'files'], 'readwrite', (tx) => {
        tx.objectStore('scores').put(meta);
        tx.objectStore('files').put(blob, meta.id);
      }),

    /* 악보 삭제 + 모든 폴더에서 빼기 */
    deleteScore: (id) =>
      run(['scores', 'files', 'folders'], 'readwrite', async (tx) => {
        tx.objectStore('scores').delete(id);
        tx.objectStore('files').delete(id);
        const fs = tx.objectStore('folders');
        const all = await reqP(fs.getAll());
        for (const f of all) {
          if (f.items.includes(id)) {
            f.items = f.items.filter((x) => x !== id);
            fs.put(f);
          }
        }
      }),

    /* 공유받은 파일함: 전부 꺼내고 비우기 */
    takeInbox: () =>
      run(['inbox'], 'readwrite', async (tx) => {
        const s = tx.objectStore('inbox');
        const items = await reqP(s.getAll());
        s.clear();
        return items;
      }),
    addInbox: (name, blob) => run(['inbox'], 'readwrite', (tx) => reqP(tx.objectStore('inbox').add({ name, blob, at: Date.now() }))),
  };

  root.DB = DB;
})(typeof self !== 'undefined' ? self : window);
