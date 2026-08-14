// 模拟 Rust 本地文件存储（app_data_dir/reference/{id}.json）
// 用 localStorage 持久化，模拟"磁盘写入"跨刷新保留
(function () {
  const KEY = '__MOCK_REF_STORE__';
  const PROJ_KEY = '__MOCK_PROJ_STORE__';
  window.__REF_STORE__ = {};
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) window.__REF_STORE__ = JSON.parse(saved);
  } catch (e) {}

  window.__PROJ_STORE__ = [];
  try {
    const savedProj = localStorage.getItem(PROJ_KEY);
    if (savedProj) window.__PROJ_STORE__ = JSON.parse(savedProj);
  } catch (e) {}

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(window.__REF_STORE__)); } catch (e) {}
    try { localStorage.setItem(PROJ_KEY, JSON.stringify(window.__PROJ_STORE__)); } catch (e) {}
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
          return window.__PROJ_STORE__ || [];
        case 'get_project_structure':
          return { id: args.projectId, name: '我的帝国', chapters: [], volumes: [] };
        case 'delete_project':
          window.__PROJ_STORE__ = (window.__PROJ_STORE__ || []).filter(p => p.id !== args.projectId);
          // 对齐真实 Rust remove_dir_all：memories.json 在项目目录内，删除项目即删除该小说全部记忆
          if (window.__MEM_STORE__) delete window.__MEM_STORE__[args.projectId];
          return null;
        case 'get_storage_path':
          return '/mock/projects';
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
        case 'get_data_dir_path':
          return '/mock/app-data-dir';
        case 'open_data_dir':
          window.__OPENED_DATA_DIR__ = true;
          return null;
        case 'save_memory':
          if (!window.__MEM_STORE__) window.__MEM_STORE__ = {};
          if (!window.__MEM_STORE__[args.projectId]) window.__MEM_STORE__[args.projectId] = [];
          const mem = JSON.parse(JSON.stringify(args.memory));
          const mi = window.__MEM_STORE__[args.projectId].findIndex(m => m.chapter_id === mem.chapter_id);
          if (mi >= 0) window.__MEM_STORE__[args.projectId][mi] = mem;
          else window.__MEM_STORE__[args.projectId].push(mem);
          return null;
        case 'list_memories':
          return window.__MEM_STORE__ && window.__MEM_STORE__[args.projectId] ? window.__MEM_STORE__[args.projectId] : [];
        case 'call_ai':
          window.__LAST_AI_ARGS__ = JSON.parse(JSON.stringify(args));
          return { content: window.__MOCK_AI_REPLY__ || '', finish_reason: 'stop' };
        case 'call_ai_stream':
          window.__LAST_AI_ARGS__ = JSON.parse(JSON.stringify(args));
          const reply = window.__MOCK_AI_REPLY__ || '';
          const evt = args.onEvent;
          if (evt && typeof evt.onmessage === 'function') {
            if (reply) evt.onmessage({ delta: reply, done: false });
            evt.onmessage({ delta: '', done: true });
          }
          return null;
        default:
          return null;
      }
    },
  };
})();
