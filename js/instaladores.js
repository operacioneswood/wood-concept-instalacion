// ─────────────────────────────────────────────────────────────
// js/instaladores.js — Administrar la lista de instaladores desde ⚙ Configuración.
//
// La lista vive en la tabla `instaladores` de Supabase (nombre, activo) y es la
// que alimenta el desplegable "Agregar instalador" de cada OP.
//   · Agregar: crea el nombre (o lo reactiva si ya estaba quitado).
//   · Quitar: lo marca como inactivo. NO borra nada: el nombre sigue apareciendo
//     en las OPs donde ya estaba asignado y en los informes; solo deja de salir
//     en el desplegable. Se puede reactivar desde "Quitados".
// ─────────────────────────────────────────────────────────────

const Instaladores = {
  _todos: [],          // [{ nombre, activo }]
  _q:     '',          // texto del buscador
  _ok:    null,        // null = sin cargar · true = cargado · false = error
  _err:   null,
  _busy:  false,

  init() {
    const body = document.querySelector('#settings-overlay .modal-body');
    if (!body || document.getElementById('cfg-inst-section')) return;
    this._ensureCss();

    const sec = document.createElement('div');
    sec.className = 'settings-section';
    sec.id = 'cfg-inst-section';
    sec.innerHTML = `
      <div class="settings-title">👷 Instaladores</div>
      <div class="cfg-hint">Los nombres que salen al asignar instaladores a una OP. Quitar a alguien no borra su historial: sigue apareciendo en las OPs donde ya estaba asignado y solo deja de salir en la lista para agregar.</div>
      <div class="cfg-inst-add">
        <input type="text" id="cfg-inst-new" class="field-input" placeholder="Nombre y apellido del nuevo instalador" maxlength="60" autocomplete="off">
        <button class="btn-primary" id="cfg-inst-add-btn">＋ Agregar</button>
      </div>
      <div id="cfg-inst-msg" class="cfg-inst-msg"></div>
      <input type="search" id="cfg-inst-q" class="field-input" placeholder="Buscar en la lista…" autocomplete="off">
      <div id="cfg-inst-list" class="cfg-inst-list"></div>
      <details class="cfg-inst-quitados" id="cfg-inst-quitados">
        <summary>Quitados (<span id="cfg-inst-nq">0</span>)</summary>
        <div id="cfg-inst-listq" class="cfg-inst-list"></div>
      </details>`;
    body.prepend(sec);

    sec.addEventListener('click', e => {
      const b = e.target.closest('[data-inst]');
      if (!b) return;
      if (b.dataset.inst === 'quitar') this._quitar(b.dataset.n);
      else if (b.dataset.inst === 'reactivar') this._reactivar(b.dataset.n);
    });
    sec.addEventListener('input', e => {
      if (e.target.id === 'cfg-inst-q') { this._q = e.target.value; this._draw(); }
    });
    sec.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.id === 'cfg-inst-new') { e.preventDefault(); this._agregar(); }
    });
    document.getElementById('cfg-inst-add-btn')?.addEventListener('click', () => this._agregar());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.refresh());
    this._draw();
  },

  // ── Datos ────────────────────────────────────────────────────
  async refresh() {
    try {
      this._todos = (await DB._q(sb => sb.from('instaladores').select('*').order('nombre'))) || [];
      this._ok = true; this._err = null;
    } catch (e) {
      this._ok = false; this._err = e.message || String(e);
    }
    this._draw();
  },

  // Avisa a la bitácora para que el desplegable de cada OP use la lista nueva.
  _sincronizarApp() {
    try {
      if (typeof App !== 'undefined' && App._dbData) {
        App._dbData.instaladores = this._todos.filter(x => x.activo);
        App._renderAll();
      }
    } catch (e) { console.warn('[Instaladores] no se pudo refrescar la bitácora:', e.message); }
  },

  // OPs de la bitácora (en pantalla ahora) donde está asignado cada instalador.
  _conteo() {
    const ids = new Set((typeof Instalacion !== 'undefined' ? Instalacion._ops : []).map(o => o.id));
    const n = {};
    ((typeof App !== 'undefined' && App._dbData?.asignaciones) || []).forEach(a => {
      if (a.etapa === 'instalacion' && ids.has(a.op_id)) n[a.persona] = (n[a.persona] || 0) + 1;
    });
    return n;
  },

  _formatear(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    // Si lo escribieron todo en minúsculas o todo en mayúsculas, se pone con inicial mayúscula en cada palabra.
    if (s === s.toLowerCase() || s === s.toUpperCase()) {
      s = s.toLowerCase().replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase());
    }
    return s;
  },

  _msg(texto, tipo) {
    const m = document.getElementById('cfg-inst-msg');
    if (m) { m.textContent = texto || ''; m.className = 'cfg-inst-msg' + (tipo ? ' cfg-inst-' + tipo : ''); }
  },

  // ── Acciones ─────────────────────────────────────────────────
  async _agregar() {
    if (this._busy) return;
    const inp = document.getElementById('cfg-inst-new');
    const nombre = this._formatear(inp?.value);
    if (nombre.length < 3) { this._msg('Escribe el nombre completo del instalador.', 'err'); return; }

    const clave = normStr(nombre);
    const existente = this._todos.find(x => normStr(x.nombre) === clave);
    if (existente && existente.activo) { this._msg(`"${existente.nombre}" ya está en la lista.`, 'err'); return; }

    this._busy = true;
    try {
      const usar = existente ? existente.nombre : nombre;   // si estaba quitado, se conserva su nombre exacto (así sus OPs anteriores siguen coincidiendo)
      await DB.addInstalador(usar);
      if (existente) existente.activo = true; else this._todos.push({ nombre: usar, activo: true });
      this._todos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      if (inp) inp.value = '';
      this._msg(existente ? `"${usar}" estaba quitado: se volvió a agregar.` : `"${usar}" se agregó a la lista.`, 'ok');
      this._draw();
      this._sincronizarApp();
    } catch (e) {
      this._msg('No se pudo agregar: ' + (e.message || e), 'err');
    }
    this._busy = false;
  },

  async _quitar(nombre) {
    if (this._busy) return;
    const n = this._conteo()[nombre] || 0;
    const aviso = n
      ? `\n\nTiene ${n} OP${n !== 1 ? 's' : ''} asignada${n !== 1 ? 's' : ''} en la bitácora: seguirá${n !== 1 ? 'n' : ''} con su nombre. Solo deja de salir en la lista para agregar.`
      : '\n\nSolo deja de salir en la lista para agregar; su historial no se borra.';
    if (!confirm(`¿Quitar a ${nombre} de la lista de instaladores?${aviso}`)) return;
    this._busy = true;
    try {
      await DB.setInstaladorActivo(nombre, false);
      const r = this._todos.find(x => x.nombre === nombre);
      if (r) r.activo = false;
      this._msg(`"${nombre}" se quitó de la lista.`, 'ok');
      this._draw();
      this._sincronizarApp();
    } catch (e) {
      this._msg('No se pudo quitar: ' + (e.message || e), 'err');
    }
    this._busy = false;
  },

  async _reactivar(nombre) {
    if (this._busy) return;
    this._busy = true;
    try {
      await DB.setInstaladorActivo(nombre, true);
      const r = this._todos.find(x => x.nombre === nombre);
      if (r) r.activo = true;
      this._msg(`"${nombre}" se volvió a agregar a la lista.`, 'ok');
      this._draw();
      this._sincronizarApp();
    } catch (e) {
      this._msg('No se pudo reactivar: ' + (e.message || e), 'err');
    }
    this._busy = false;
  },

  // ── Dibujo ───────────────────────────────────────────────────
  _draw() {
    const list = document.getElementById('cfg-inst-list');
    if (!list) return;
    if (this._ok === false) {
      list.innerHTML = `<div class="cfg-inst-vacio">⚠ No se pudo cargar la lista (${esc(this._err || '')}).</div>`;
      return;
    }
    if (this._ok === null) { list.innerHTML = '<div class="cfg-inst-vacio">Cargando…</div>'; return; }

    const conteo = this._conteo();
    const q = normStr(this._q);
    const activos = this._todos.filter(x => x.activo && (!q || normStr(x.nombre).includes(q)));
    const totalActivos = this._todos.filter(x => x.activo).length;

    list.innerHTML = activos.length
      ? activos.map(x => `
          <div class="cfg-inst-row">
            <span class="cfg-inst-name">${esc(x.nombre)}</span>
            ${conteo[x.nombre] ? `<span class="cfg-inst-n">${conteo[x.nombre]} OP${conteo[x.nombre] !== 1 ? 's' : ''}</span>` : ''}
            <button class="btn-secondary btn-sm" data-inst="quitar" data-n="${esc(x.nombre)}" title="Quitar de la lista">Quitar</button>
          </div>`).join('')
      : `<div class="cfg-inst-vacio">${q ? 'Sin resultados.' : 'Todavía no hay instaladores. Agrega el primero arriba.'}</div>`;

    const titulo = document.querySelector('#cfg-inst-section .settings-title');
    if (titulo) titulo.textContent = `👷 Instaladores (${totalActivos})`;

    const quitados = this._todos.filter(x => !x.activo);
    const nq = document.getElementById('cfg-inst-nq');
    if (nq) nq.textContent = quitados.length;
    const lq = document.getElementById('cfg-inst-listq');
    if (lq) {
      lq.innerHTML = quitados.length
        ? quitados.map(x => `
            <div class="cfg-inst-row">
              <span class="cfg-inst-name cfg-inst-off">${esc(x.nombre)}</span>
              <button class="btn-secondary btn-sm" data-inst="reactivar" data-n="${esc(x.nombre)}">Volver a agregar</button>
            </div>`).join('')
        : '<div class="cfg-inst-vacio">Nadie quitado.</div>';
    }
  },

  _ensureCss() {
    if (document.getElementById('cfg-inst-css')) return;
    const st = document.createElement('style');
    st.id = 'cfg-inst-css';
    st.textContent = `
.cfg-inst-add{display:flex;gap:8px;align-items:stretch;margin-bottom:6px}
.cfg-inst-add .field-input{flex:1;min-width:0}
.cfg-inst-add .btn-primary{white-space:nowrap}
.cfg-inst-msg{font-size:12px;min-height:16px;margin:0 0 8px;color:var(--muted)}
.cfg-inst-ok{color:var(--green)}
.cfg-inst-err{color:var(--red)}
.cfg-inst-list{max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:8px;margin-top:8px;background:var(--card)}
.cfg-inst-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--divider)}
.cfg-inst-row:last-child{border-bottom:0}
.cfg-inst-name{flex:1;font-size:14px;min-width:0;overflow-wrap:anywhere}
.cfg-inst-off{color:var(--muted)}
.cfg-inst-n{font-size:12px;color:var(--muted);white-space:nowrap}
.cfg-inst-vacio{padding:12px;font-size:13px;color:var(--muted)}
.cfg-inst-quitados{margin-top:10px;font-size:13px}
.cfg-inst-quitados summary{cursor:pointer;color:var(--muted);font-weight:600}
`;
    document.head.appendChild(st);
  },
};

document.addEventListener('DOMContentLoaded', () => Instaladores.init());
