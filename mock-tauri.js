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

  // 章节存储（模拟项目内 chapters/，用 localStorage 持久化跨 reload）
  const CH_KEY = '__MOCK_CH_JSON__';
  window.__CHAPTERS_STORE__ = {};
  try {
    const savedCh = localStorage.getItem(CH_KEY);
    if (savedCh) window.__CHAPTERS_STORE__ = JSON.parse(savedCh);
  } catch (e) {}

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(window.__REF_STORE__)); } catch (e) {}
    try { localStorage.setItem(PROJ_KEY, JSON.stringify(window.__PROJ_STORE__)); } catch (e) {}
    try { localStorage.setItem(CH_KEY, JSON.stringify(window.__CHAPTERS_STORE__ || {})); } catch (e) {}
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
        case 'create_project': {
          const np = {
            id: 'p_' + Math.random().toString(36).slice(2, 10),
            name: args.name,
            description: args.description || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            storage_path: null,
          };
          window.__PROJ_STORE__ = window.__PROJ_STORE__ || [];
          window.__PROJ_STORE__.unshift(np);
          return np;
        }
        case 'delete_chapter': {
          delete window.__CHAPTERS_STORE__[args.fileName];
          persist();
          return null;
        }
        case 'rename_chapter': {
          if (window.__CHAPTERS_STORE__ && window.__CHAPTERS_STORE__[args.oldName]) {
            const c = window.__CHAPTERS_STORE__[args.oldName];
            delete window.__CHAPTERS_STORE__[args.oldName];
            window.__CHAPTERS_STORE__[args.newName] = c;
          }
          persist();
          return null;
        }
        case 'list_backups':
          window.__BACKUP_STORE__ = window.__BACKUP_STORE__ || {};
          return window.__BACKUP_STORE__[args.projectId] || [];
        case 'backup_project': {
          window.__BACKUP_STORE__ = window.__BACKUP_STORE__ || {};
          if (!window.__BACKUP_STORE__[args.projectId]) window.__BACKUP_STORE__[args.projectId] = [];
          const ts = new Date();
          const pad = (n) => String(n).padStart(2, '0');
          const name = `${args.projectId}_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}_${Math.random().toString(36).slice(2, 6)}`;
          window.__BACKUP_STORE__[args.projectId].unshift(name);
          return name;
        }
        case 'restore_backup':
          return null;
        case 'delete_backup':
          window.__BACKUP_STORE__ = window.__BACKUP_STORE__ || {};
          window.__BACKUP_STORE__[args.projectId] = (window.__BACKUP_STORE__[args.projectId] || []).filter((n) => n !== args.backupName);
          return null;
        case 'save_character':
        case 'delete_character':
        case 'update_project_info':
        case 'save_world':
          return null;
        case 'get_skills_dir_path':
          return '/mock/skills';
        case 'get_project_structure': {
          const proj = (window.__PROJ_STORE__ || []).find(p => p.id === args.projectId);
          const chapters = Object.entries(window.__CHAPTERS_STORE__ || {})
            .map(([fn, c], i) => ({
              id: String(i), title: c.title, file_name: fn, group: '', order: i,
              word_count: (c.content || '').replace(/\s/g, '').length,
              created_at: '', updated_at: '',
            }));
          return {
            project: {
              id: args.projectId,
              name: proj?.name || '',
              description: proj?.description || '',
              created_at: proj?.created_at || '',
              updated_at: proj?.updated_at || '',
              storage_path: proj?.storage_path || null,
            },
            chapters,
            groups: [],
            characters: [],
            world_setting: null,
            memories: [],
          };
        }
        case 'save_chapter': {
          window.__CHAPTERS_STORE__ = window.__CHAPTERS_STORE__ || {};
          window.__CHAPTERS_STORE__[args.chapterTitle + '.md'] = { title: args.chapterTitle, content: args.content };
          persist();
          return null;
        }
        case 'read_chapter': {
          const c = (window.__CHAPTERS_STORE__ || {})[args.fileName];
          return c ? c.content : '';
        }
        case 'delete_project':
          window.__PROJ_STORE__ = (window.__PROJ_STORE__ || []).filter(p => p.id !== args.projectId);
          // 对齐真实 Rust remove_dir_all：memories.json 在项目目录内，删除项目即删除该小说全部记忆
          if (window.__MEM_STORE__) delete window.__MEM_STORE__[args.projectId];
          window.__CHAPTERS_STORE__ = {};
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
          window.__AI_CALL_COUNT__ = (window.__AI_CALL_COUNT__ || 0) + 1;
          window.__LAST_AI_ARGS__ = JSON.parse(JSON.stringify(args));
          const replyContent = typeof window.__MOCK_AI_SEQ__ === 'function'
            ? window.__MOCK_AI_SEQ__(window.__AI_CALL_COUNT__, args)
            : (window.__MOCK_AI_REPLY__ || '');
          return { content: replyContent, finish_reason: 'stop' };
        case 'call_ai_stream':
          window.__AI_CALL_COUNT__ = (window.__AI_CALL_COUNT__ || 0) + 1;
          window.__LAST_AI_ARGS__ = JSON.parse(JSON.stringify(args));
          const reply = typeof window.__MOCK_AI_SEQ__ === 'function'
            ? window.__MOCK_AI_SEQ__(window.__AI_CALL_COUNT__, args)
            : (window.__MOCK_AI_REPLY__ || '');
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
