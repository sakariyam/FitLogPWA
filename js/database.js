const appStorage = (() => {
  let connection;

  function open() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open('fitlog', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('save');
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Close other FitLog windows and try again.'));
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => { database.close(); connection = null; };
          resolve(database);
        };
      }).catch((error) => { connection = null; throw error; });
    }
    return connection;
  }

  async function transact(mode, operation) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('save', mode);
      let result;
      transaction.oncomplete = () => resolve(typeof result === 'function' ? result() : result);
      transaction.onabort = () => reject(transaction.error || new Error('Save transaction aborted.'));
      transaction.onerror = () => {};
      try {
        result = operation(transaction.objectStore('save'));
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  function reportFailure(error) {
    console.error('FitLog could not save', error);
    let status = document.getElementById('storage-status');
    if (!status) {
      status = document.createElement('p');
      status.id = 'storage-status';
      status.setAttribute('role', 'alert');
      document.body.prepend(status);
    }
    status.textContent = 'Changes could not be saved on this device. Check available storage and reload before continuing.';
    return false;
  }

  return {
    get() {
      return transact('readonly', (store) => {
        const keys = store.getAllKeys();
        const values = store.getAll();
        return () => Object.fromEntries(keys.result.map((key, index) => [key, values.result[index]]));
      });
    },
    set(values) {
      try {
        const snapshot = structuredClone(values);
        return transact('readwrite', (store) => {
          Object.entries(snapshot).forEach(([key, value]) => store.put(value, key));
          return true;
        }).catch(reportFailure);
      } catch (error) {
        return Promise.resolve(reportFailure(error));
      }
    },
    remove(keys) {
      return transact('readwrite', (store) => {
        keys.forEach((key) => store.delete(key));
        return true;
      }).catch(reportFailure);
    }
  };
})();