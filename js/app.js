// ─────────────────────────────────────────────────────────────
// js/app.js — Application bootstrap, routing, auto-refresh
// ─────────────────────────────────────────────────────────────

const App = {
  _data:             null,   // ClickUp data: { installOps, instaladoresList, fieldIds, lastSync }
  _dbData:           null,   // Supabase data: { asignaciones, bitacoraInstalacion, instalacionOps }
  _refreshTimer:     null,
  _REFRESH_INTERVAL: 5 * 60 * 1000,

  async init() {
    DB.init();
    this._setupSettings();
    this._setupNav();

    this._dbData = { asignaciones: [], bitacoraInstalacion: [], instalacionOps: [] };
    await this._loadDbData();

    const cached = PlantaAPI._getCache();
    if (cached) {
      this._data = cached;
      this._renderAll();
      this._setStatus('⚡ Desde caché', 'ok');
    } else {
      this._setStatus('Conectando...', 'loading');
    }

    await this._sync({ silent: !!cached });
    this._refreshTimer = setInterval(() => this._sync({ silent: true }), this._REFRESH_INTERVAL);
  },

  async _loadDbData() {
    try {
      const [asignaciones, bitacoraInstalacion, instalacionOps] = await Promise.all([
        DB.getAsignaciones(),
        DB.getBitacoraInstalacion().catch(e => { console.warn('[App] bitacora_instalacion table missing?', e.message); return []; }),
        DB.getInstalacionOps().catch(e => { console.warn('[App] instalacion_ops table missing?', e.message); return []; }),
      ]);
      this._dbData = {
        asignaciones:        asignaciones        || [],
        bitacoraInstalacion: bitacoraInstalacion || [],
        instalacionOps:      instalacionOps      || [],
      };
    } catch (e) {
      console.error('[App] DB load failed:', e.message);
    }
  },

  // ── Sync ─────────────────────────────────────────────────
  _syncPromise: null,

  _sync(opts) {
    if (this._syncPromise) return this._syncPromise;
    this._syncPromise = this._doSync(opts).finally(() => { this._syncPromise = null; });
    return this._syncPromise;
  },

  async _doSync({ force = false, silent = false } = {}) {
    if (!silent) this._setStatus('Sincronizando...', 'loading');
    try {
      this._data = await PlantaAPI.fetchOPs({
        force,
        onProgress: msg => { if (!silent) this._setStatus(msg, 'loading'); },
      });
      await this._loadDbData();
      this._renderAll();
      this._setStatus(this._syncLabel(), 'ok');
    } catch (e) {
      console.error('[App] Sync error:', e);
      this._setStatus('Error: ' + e.message, 'error');
    }
  },

  _syncLabel() {
    const d = new Date(this._data?.lastSync || Date.now());
    return `↻ ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  },

  _setStatus(msg, type) {
    const s = el('sync-status');
    if (!s) return;
    s.textContent = msg;
    s.className   = `sync-status sync-${type}`;
  },

  // ── Render ───────────────────────────────────────────────
  _renderAll() {
    if (!this._data) return;
    Instalacion.render({ ...this._data, dbData: this._dbData });
    Cronograma.render({ ...this._data });
  },

  // ── Navigation ────────────────────────────────────────────
  _setupNav() {
    document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-screen').forEach(s => s.classList.remove('tab-active'));
        el('tab-' + btn.dataset.tab)?.classList.add('tab-active');
      });
    });
  },

  // ── Settings modal ───────────────────────────────────────
  _setupSettings() {
    const overlay   = el('settings-overlay');
    const keyInput  = el('cfg-api-key');
    const listInput = el('cfg-list-id');
    const syncBtn   = el('cfg-sync-btn');
    const statusEl  = el('cfg-sync-status');

    if (keyInput)  keyInput.value  = localStorage.getItem('wi_api_key') || '';
    if (listInput) listInput.value = localStorage.getItem('wi_list_id') || '';

    el('btn-settings')?.addEventListener('click', () => { overlay.style.display = 'flex'; });
    el('btn-settings-close')?.addEventListener('click', () => { overlay.style.display = 'none'; });
    overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });

    el('btn-refresh')?.addEventListener('click', () => this._sync({ force: true }));

    syncBtn?.addEventListener('click', async () => {
      if (keyInput.value.trim())  PlantaAPI.setApiKey(keyInput.value);
      if (listInput.value.trim()) PlantaAPI.setListId(listInput.value);
      PlantaAPI.clearCache();
      statusEl.textContent = 'Sincronizando...';
      await this._sync({ force: true });
      statusEl.textContent = '✓ Sincronizado';
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
