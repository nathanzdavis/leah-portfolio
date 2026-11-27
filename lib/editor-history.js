const storageKey = 'leah-editor-undo-v1';
const maxEntries = 16;
const maxStorageLength = 2_000_000;

export function createDraftHistory(storage, updatedAt, initial, pageId) {
  let entries = [{ data: initial, pageId }];
  let index = 0;
  let base = updatedAt;
  try {
    const saved = JSON.parse(storage.getItem(storageKey));
    if (saved?.base === base && saved.entries?.[saved.index]?.data) {
      ({ entries, index } = saved);
    }
  } catch {}

  function persist() {
    let saved = entries;
    let cursor = index;
    let encoded = JSON.stringify({ base, entries: saved, index: cursor });
    while (encoded.length > maxStorageLength && saved.length > 1) {
      if (cursor > 0) {
        saved = saved.slice(1);
        cursor--;
      } else {
        saved = saved.slice(0, -1);
      }
      encoded = JSON.stringify({ base, entries: saved, index: cursor });
    }
    try {
      if (encoded.length <= maxStorageLength) storage.setItem(storageKey, encoded);
      else storage.removeItem(storageKey);
    } catch {}
  }

  return {
    current: () => entries[index],
    record(data, pageId) {
      if (data === entries[index].data) return;
      entries = [...entries.slice(0, index + 1), { data, pageId }].slice(-maxEntries);
      index = entries.length - 1;
      persist();
    },
    normalize(data) {
      entries[index] = { ...entries[index], data };
      persist();
    },
    saved(updatedAt) {
      base = updatedAt;
      persist();
    },
    step(direction) {
      if (!entries[index + direction]) return null;
      index += direction;
      persist();
      return entries[index];
    },
    clear() {
      try { storage.removeItem(storageKey); } catch {}
    },
  };
}

export function draftHistoryData(doc) {
  return JSON.stringify({ pages: doc.pages, projectData: doc.projectData });
}
