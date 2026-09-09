// ─────────────────────────────────────────────────────────────
// js/clickup.js — ClickUp API integration for Instalación
//
// Reads OP tasks from a List/Folder filtered to INSTALL_STATUSES
// ("empaque", "en instalacion") — the same workspace wood-concept-planta
// reads from, just a different status slice (planta only ever sees the
// factory-floor statuses; this app only cares about what's already left
// the factory).
//
// Depends on: config.js
// ─────────────────────────────────────────────────────────────

const PlantaAPI = {

  _CACHE_KEY: 'wi_tasks_cache',
  _CACHE_TTL: 5 * 60 * 1000,   // 5 min

  // ── Credential helpers ────────────────────────────────────
  getApiKey()   { return localStorage.getItem('wi_api_key') || DEFAULT_API_KEY; },
  setApiKey(k)  { localStorage.setItem('wi_api_key', k.trim()); },
  getListId()   { return localStorage.getItem('wi_list_id') || DEFAULT_LIST_ID; },
  setListId(id) { localStorage.setItem('wi_list_id', id.trim()); },

  // ── Cache ─────────────────────────────────────────────────
  _getCache() {
    try {
      const raw = localStorage.getItem(this._CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || !c.timestamp || !Array.isArray(c.installOps)) return null;
      c.installOps = c.installOps.map(op => this._rehydrateOp(op));
      return c;
    } catch { return null; }
  },

  _rehydrateOp(op) {
    const dateKeys = ['fechaEmpaque', 'envioInstalacion', 'inicioInstalacion'];
    const out = { ...op };
    for (const k of dateKeys) {
      if (out[k] && typeof out[k] === 'string') out[k] = new Date(out[k]);
      else if (!out[k]) out[k] = null;
    }
    return out;
  },

  _setCache(data) {
    try {
      localStorage.setItem(this._CACHE_KEY, JSON.stringify({ timestamp: Date.now(), ...data }));
    } catch (e) {
      console.warn('[PlantaAPI] Cache write failed:', e.message);
      try { localStorage.removeItem(this._CACHE_KEY); } catch {}
    }
  },

  clearCache() { localStorage.removeItem(this._CACHE_KEY); },

  // ── Low-level HTTP ────────────────────────────────────────
  async _call(path, params = {}) {
    const apiKey = this.getApiKey();
    const url = new URL(`https://api.clickup.com/api/v2/${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
    if (!res.ok) throw new Error(`ClickUp ${res.status} — ${path}`);
    return res.json();
  },

  // ── Resolve entered ID to a list of list-ids ─────────────
  async _resolveToListIds(id) {
    const [listRes, folderRes, spaceFolderRes, spaceListRes] = await Promise.allSettled([
      this._call(`list/${id}`),
      this._call(`folder/${id}/list`,  { archived: 'false' }),
      this._call(`space/${id}/folder`, { archived: 'false' }),
      this._call(`space/${id}/list`,   { archived: 'false' }),
    ]);

    const spaceFolders = spaceFolderRes.status === 'fulfilled' ? (spaceFolderRes.value.folders || []) : [];
    const spaceRoots   = spaceListRes.status   === 'fulfilled' ? (spaceListRes.value.lists     || []) : [];
    if (spaceFolders.length || spaceRoots.length) {
      const nested = (await Promise.all(
        spaceFolders.map(f => this._call(`folder/${f.id}/list`, { archived: 'false' })
          .then(d => (d.lists || []).map(l => l.id)).catch(() => []))
      )).flat();
      return { listIds: [...new Set([...nested, ...spaceRoots.map(l => l.id)])] };
    }

    const folderLists = folderRes.status === 'fulfilled' ? (folderRes.value.lists || []) : [];
    if (folderLists.length) return { listIds: folderLists.map(l => l.id) };

    return { listIds: [id] };
  },

  // ── Fetch all pages from a single list ───────────────────
  async _fetchAllPages(listId, onProgress) {
    const tasks = [];
    for (let page = 0; page < 20; page++) {
      const data = await this._call(`list/${listId}/task`, {
        include_closed: 'true',
        subtasks:       'true',
        page:           String(page),
      });
      const batch = data.tasks || [];
      tasks.push(...batch);
      if (onProgress) onProgress(tasks.length);
      if (batch.length < 100 || data.last_page) break;
    }
    return tasks;
  },

  // ── Detect custom field IDs from raw tasks ────────────────
  _detectFields(rawTasks) {
    const fieldMap = {};   // normalizedName → { id, type, typeConfig }
    const instaladoresSet = new Set();
    const instaladorOpts  = {}; // normStr(name) → ClickUp option UUID
    const estatusInstalacionOpts = {}; // normStr(optionName) → ClickUp option UUID

    for (const t of rawTasks) {
      for (const cf of (t.custom_fields || [])) {
        const norm = normStr(cf.name);
        if (!fieldMap[norm]) {
          fieldMap[norm] = { id: cf.id, name: cf.name, type: cf.type, typeConfig: cf.type_config };
        }
        if (norm.includes('instalador') && cf.type === 'drop_down') {
          for (const opt of (cf.type_config?.options || [])) {
            if (opt.name) {
              instaladoresSet.add(opt.name);
              instaladorOpts[normStr(opt.name)] = opt.id;
            }
          }
        }
        if (norm.includes('estatus instalac') && cf.type === 'drop_down') {
          for (const opt of (cf.type_config?.options || [])) {
            if (opt.name) estatusInstalacionOpts[normStr(opt.name)] = opt.id;
          }
        }
      }
    }

    const find = (...patterns) => {
      for (const [key, val] of Object.entries(fieldMap)) {
        if (patterns.some(p => key.includes(p))) return val.id;
      }
      return null;
    };

    const fieldIds = {
      noOp:               find('no. op', 'no op', 'nro. op', 'nro op', 'numero op', 'num op'),
      fechaEmpaque:       find('fecha de empaque', 'fecha empaque'),
      envioInstalacion:   find('envio para instalacion', 'envío para instalación'),
      inicioInstalacion:  find('inicio de instalacion', 'inicio de instalación'),
      estatusInstalacion: find('estatus instalacion', 'estatus instalación'),
      estatusInstalacionOpts,
      instaladores:       find('instaladores', 'instalador'),
      instaladorOpts,
    };

    return { fieldIds, instaladoresList: [...instaladoresSet].sort() };
  },

  // ── Parse a raw task into an OP object ───────────────────
  _parseTask(raw, fieldIds) {
    const getField = id => {
      if (!id) return null;
      const cf = (raw.custom_fields || []).find(f => f.id === id);
      if (!cf) return null;
      return cf.value ?? null;
    };

    const getDropdownName = id => {
      if (!id) return null;
      const cf = (raw.custom_fields || []).find(f => f.id === id);
      if (!cf) return null;
      const v = cf.value;
      if (v === null || v === undefined) return null;
      if (typeof v === 'object' && v?.name) return v.name;
      if (typeof v === 'string' && isNaN(Number(v))) return v;
      const idx = typeof v === 'number' ? v : Number(v);
      if (!isNaN(idx)) {
        const opts = cf.type_config?.options || [];
        const opt  = opts.find(o => o.orderindex === idx) ||
                     opts.find(o => String(o.id) === String(v));
        return opt?.name || null;
      }
      return null;
    };

    const getDate = id => tsToDate(getField(id));

    const noOpRaw = getField(fieldIds.noOp);
    const noOp    = noOpRaw !== null && noOpRaw !== undefined ? String(noOpRaw) : '';

    return {
      id:                 raw.id,
      name:               raw.name || '',
      noOp,
      parent:             raw.parent || null,
      project:            raw.folder?.name || raw.list?.name || '',
      status:             normStr(raw.status?.status || ''),
      statusRaw:          raw.status?.status || '',
      fechaEmpaque:       getDate(fieldIds.fechaEmpaque),
      envioInstalacion:   getDate(fieldIds.envioInstalacion),
      inicioInstalacion:  getDate(fieldIds.inicioInstalacion),
      estatusInstalacion: getDropdownName(fieldIds.estatusInstalacion),
      instalador:         getDropdownName(fieldIds.instaladores),
    };
  },

  // ── Set a custom field value on a task (date ms or dropdown option id) ──
  async setField(taskId, fieldId, value) {
    const apiKey = this.getApiKey();
    const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${fieldId}`, {
      method:  'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ value }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => String(res.status));
      throw new Error(`ClickUp field ${res.status}: ${msg}`);
    }
    const text = await res.text();
    try { return text ? JSON.parse(text) : {}; }
    catch { return {}; }
  },

  // ── Main entry point ─────────────────────────────────────
  async fetchOPs({ force = false, onProgress } = {}) {
    const prog = msg => { if (onProgress) onProgress(msg); };

    if (!force) {
      const cached = this._getCache();
      if (cached && (Date.now() - cached.timestamp < this._CACHE_TTL)) {
        prog('⚡ Datos en caché');
        return cached;
      }
    }

    prog('Conectando con ClickUp...');
    const listId = this.getListId();
    const { listIds } = await this._resolveToListIds(listId);

    let total = 0;
    const batches = await Promise.all(
      listIds.map(lid => this._fetchAllPages(lid, n => {
        total = n;
        prog(`Cargando tareas... (${total})`);
      }))
    );

    const seen = new Set();
    const rawTasks = batches.flat().filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    prog(`Procesando ${rawTasks.length} tareas...`);

    const { fieldIds, instaladoresList } = this._detectFields(rawTasks);

    // Build a node map for chain traversal: id → { name, parent }
    const nodeMap = {};
    for (const t of rawTasks) {
      nodeMap[t.id] = { name: t.name || '', parent: t.parent || null };
    }
    const findRootProject = id => {
      const seenIds = new Set();
      let cur = nodeMap[id];
      while (cur) {
        if (!cur.parent) return cur.name;
        if (seenIds.has(cur.parent)) return null;
        seenIds.add(cur.parent);
        cur = nodeMap[cur.parent];
      }
      return null;
    };

    const installOps = rawTasks
      .filter(t => t.parent && INSTALL_STATUSES.has(normStr(t.status?.status || '')))
      .map(t => {
        const rootProject = findRootProject(t.id);
        if (!rootProject) return null;
        const op = this._parseTask(t, fieldIds);
        op.project  = rootProject;
        op.parentId = t.parent;
        return op;
      })
      .filter(Boolean);

    prog(`${installOps.length} OPs en empaque/instalación encontrados.`);

    const result = { installOps, instaladoresList, fieldIds, lastSync: Date.now() };
    this._setCache(result);
    return result;
  },
};
