// 模拟 Rust 本地文件存储（app_data_dir/reference/{id}.json）
// 用 localStorage 持久化，模拟"磁盘写入"跨刷新保留
(function () {
  const KEY = '__MOCK_REF_STORE__';
  window.__REF_STORE__ = {};
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) window.__REF_STORE__ = JSON.parse(saved);
  } catch (e) {}

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(window.__REF_STORE__)); } catch (e) {}
  }

  window.__TAURI_INTERNALS__ = {
    transformCallback: (cb, once) => {
      const key = `_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window[key] = (args) => { cb(args); delete window[key]; };
      return key;
    },
    invoke: async (cmd, args = {}) => {
      switch (cmd) {
        case 'list_projects':
          return [];
        case 'save_reference_state':
          window.__REF_STORE__[args.id] = JSON.parse(JSON.stringify(args.data));
          persist();
          return null;
        case 'load_reference_states':
          return Object.values(window.__REF_STORE__).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        case 'delete_reference_state':
          delete window.__REF_STORE__[args.id];
          persist();
          return null;
        default:
          return null;
      }
    },
  };
})();
