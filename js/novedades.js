// ─────────────────────────────────────────────────────────────
// js/novedades.js — "🔔 Actualizaciones": resumen imprimible de lo más
// reciente en los proyectos (uso interno).
//
// Junta, en un periodo, lo que ya guarda la bitácora (comentarios, inicios,
// pausas, reprocesos, fotos) con el registro de cambios (tabla
// cambios_instalacion: días, fechas de inicio, avance, instaladores,
// estatus y OPs completadas) y lo presenta así:
//   página 1  → resumen general (cifras y destacados)
//   siguientes → por proyecto, en orden cronológico
// ─────────────────────────────────────────────────────────────

const Novedades = {
  _periodo:  '7',            // 'ultima' | '7' | '14' | '30' | 'rango'
  _desde:    '',
  _hasta:    '',
  _excluir:  new Set(),      // proyectos que se quitan del informe
  _cambios:  [],
  _cambiosErr: null,
  _cargado:  null,           // desde qué fecha se cargaron los cambios
  _LS:       'wi_novedades_ultima',
  _MESES:    ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],

  // ── Entrada ──────────────────────────────────────────────────
  open() {
    this._ensureCss();
    this._excluir = new Set();
    this._periodo = this._ultimaImpresion() ? 'ultima' : '7';
    this._desde = this._hasta = '';
    this._build();
    this._cargarCambios().then(() => this._refresh());
  },

  close() {
    document.getElementById('nv-overlay')?.remove();
    document.body.style.overflow = '';
  },

  _ultimaImpresion() {
    try { const v = localStorage.getItem(this._LS); return v ? new Date(v) : null; } catch { return null; }
  },

  // ── Periodo ──────────────────────────────────────────────────
  _range() {
    const to = new Date();
    let from;
    if (this._periodo === 'rango') {
      from = this._desde ? new Date(this._desde + 'T00:00:00') : new Date(Date.now() - 7 * 86400000);
      const h = this._hasta ? new Date(this._hasta + 'T23:59:59') : to;
      return { from, to: h };
    }
    if (this._periodo === 'ultima') {
      from = this._ultimaImpresion() || new Date(Date.now() - 7 * 86400000);
    } else {
      from = new Date(Date.now() - parseInt(this._periodo, 10) * 86400000);
    }
    return { from, to };
  },

  async _cargarCambios() {
    const { from } = this._range();
    // Se piden siempre con un margen de 90 días para no volver a consultar al cambiar de periodo.
    const base = new Date(Math.min(from.getTime(), Date.now() - 90 * 86400000));
    if (this._cargado && base >= this._cargado && !this._cambiosErr) return;
    try {
      this._cambios = await DB.getCambios(base.toISOString());
      this._cambiosErr = null;
      this._cargado = base;
    } catch (e) {
      this._cambios = [];
      this._cambiosErr = e.message || String(e);
    }
  },

  // ── Eventos ──────────────────────────────────────────────────
  _fmtFecha(d) { return `${d.getDate()} ${this._MESES[d.getMonth()]}`; },

  _fmtVal(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-').map(Number); return `${d} ${this._MESES[m - 1]}`; }
    return v;
  },

  // Convierte un registro de cambios en texto entendible.
  _describirCambio(c) {
    const a = this._fmtVal(c.anterior), n = this._fmtVal(c.nuevo);
    const det = c.detalle || null;
    switch (c.campo) {
      case 'dias_estimados':
        return c.anterior === null
          ? { kind: 'cronograma', icon: '📅', text: `Cronograma definido: ${n} día(s) de instalación`, sub: det }
          : { kind: 'cronograma', icon: '📅', text: `Días de instalación: ${a} → ${n}`, sub: det };
      case 'dias_retoques':
        return { kind: 'cronograma', icon: '📅', text: `Días de retoques: ${a} → ${n}`, sub: det };
      case 'fecha_inicio_plan':
        return { kind: 'cronograma', icon: '📅', text: `Inicio del cronograma: ${a} → ${n}`, sub: det };
      case 'fecha_inicio_retoques':
        return { kind: 'cronograma', icon: '📅', text: `Inicio de retoques: ${a} → ${n}`, sub: det };
      case 'fecha_envio':   return { kind: 'fecha', icon: '🚚', text: `Envío a sitio: ${a} → ${n}`, sub: det };
      case 'fecha_inicio':  return { kind: 'fecha', icon: '▶',  text: `Inicio de instalación: ${a} → ${n}`, sub: det };
      case 'fecha_fin':     return { kind: 'fecha', icon: '🏁', text: `Fin de instalación: ${a} → ${n}`, sub: det };
      case 'porcentaje':    return { kind: 'avance', icon: '📊', text: `Avance: ${c.anterior === null ? '—' : c.anterior + '%'} → ${c.nuevo === null ? '—' : c.nuevo + '%'}`, sub: det };
      case 'estatus_instalacion':
        return { kind: 'estatus', icon: '📊', text: `Estatus de instalación: ${a} → ${n}`, sub: det };
      case 'instalador_agregado':
        return { kind: 'instalador', icon: '👷', text: `Instalador asignado: ${n}`, sub: det };
      case 'instalador_quitado':
        return { kind: 'instalador', icon: '👷', text: `Instalador retirado: ${a}`, sub: det };
      case 'estado':
        return { kind: 'completa', icon: '✔', text: 'OP completada', sub: det };
      default:
        return { kind: 'otro', icon: '•', text: `${c.campo}: ${a} → ${n}`, sub: det };
    }
  },

  _describirBitacora(e) {
    const t = e.tipo || 'nota';
    const map = {
      nota:         { kind: 'nota',      icon: '📝', label: '' },
      inicio:       { kind: 'inicio',    icon: '▶',  label: 'Inició instalación' },
      pausa:        { kind: 'pausa',     icon: '⏸',  label: 'Pausa' },
      reanudado:    { kind: 'inicio',    icon: '▶',  label: 'Reanudado' },
      cambio_sitio: { kind: 'sitio',     icon: '🔁', label: 'Cambio en sitio' },
      reproceso:    { kind: 'reproceso', icon: '⚠',  label: 'Reproceso' },
      fin:          { kind: 'completa',  icon: '✔',  label: 'Instalación completada' },
    };
    const m = map[t] || map.nota;
    const texto = (e.texto || '').trim();
    const text = m.label ? (texto ? `${m.label}: ${texto}` : m.label) : (texto || 'Foto');
    return { kind: m.kind, icon: m.icon, text, sub: null, foto: e.foto_url || null };
  },

  _collect() {
    const { from, to } = this._range();
    const opMap = Object.fromEntries((Instalacion._ops || []).map(o => [o.id, o]));
    const ev = [];
    const push = (ts, opId, d) => {
      if (ts < from || ts > to) return;
      const op = opMap[opId];
      if (!op) return;   // OP que ya no está en la bitácora (proyecto cerrado, etc.)
      ev.push({ ts, op, proj: op.project || '(Sin proyecto)', ...d });
    };
    (Instalacion._dbData?.bitacoraInstalacion || []).forEach(e => push(new Date(e.created_at), e.op_id, this._describirBitacora(e)));
    this._cambios.forEach(c => push(new Date(c.created_at), c.op_id, this._describirCambio(c)));
    ev.sort((a, b) => a.ts - b.ts);
    return { ev, from, to };
  },

  // ── Documento (vista previa + impresión) ─────────────────────
  _docCss() {
    return `
.nv-sheet{font-family:'Segoe UI',Arial,sans-serif;color:#111;font-size:10pt;line-height:1.4;background:#fff;padding:18px 16px}
.nv-title{border-bottom:2.5pt solid #8B1A1A;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.nv-title h1{font-size:15pt;color:#8B1A1A;margin:0;letter-spacing:-.02em}
.nv-per{font-size:9.5pt;color:#555;text-align:right}
.nv-tiles{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 6px}
.nv-tile{flex:1;min-width:105px;border:1px solid #d8d2cb;border-radius:6px;padding:8px 6px;text-align:center}
.nv-tile b{display:block;font-size:20pt;line-height:1.1;color:#111}
.nv-tile span{font-size:8pt;color:#666;text-transform:uppercase;letter-spacing:.04em}
.nv-h2{font-size:11pt;font-weight:700;color:#8B1A1A;margin:16px 0 6px;border-bottom:1px solid #e8e0db;padding-bottom:3px;break-after:avoid}
.nv-li{padding:4px 0;border-bottom:.5pt solid #eee;break-inside:avoid}
.nv-li small{color:#666}
.nv-vacio{color:#888;font-style:italic;padding:14px 0}
.nv-detalle{break-before:page}
.nv-proj{margin:0 0 16px}
.nv-proj-h{background:#1a1714;color:#fff;padding:7px 12px;font-weight:700;font-size:10pt;letter-spacing:.05em;text-transform:uppercase;display:flex;justify-content:space-between;gap:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-after:avoid}
.nv-proj-h span{font-weight:500;font-size:8.5pt;opacity:.8;text-transform:none;letter-spacing:0}
.nv-row{display:flex;gap:10px;padding:6px 4px;border-bottom:.5pt solid #e5e0da;break-inside:avoid}
.nv-d{width:44px;flex:none;color:#666;font-size:9pt;padding-top:1px}
.nv-i{width:18px;flex:none;text-align:center}
.nv-t{flex:1}
.nv-t b{color:#8B1A1A}
.nv-sub{color:#555;font-size:9pt}
.nv-foto{display:block;margin-top:4px;max-width:220px;max-height:160px;border:.5pt solid #bbb}
.nv-foot{margin-top:14px;font-size:8pt;color:#999;text-align:right}
`;
  },

  _docHtml(data) {
    const { ev, from, to } = data;
    const sel = ev.filter(e => !this._excluir.has(e.proj));
    const hoy = new Date();
    const f = d => `${d.getDate()} ${this._MESES[d.getMonth()]} ${d.getFullYear()}`;
    const per = `${f(from)} – ${f(to)}`;
    const opLbl = e => `<b>${esc(e.op.noOp || '—')}</b> · ${esc(e.op.name)}`;

    const por = k => sel.filter(e => e.kind === k);
    const completas = sel.filter(e => e.kind === 'completa');
    const cron      = por('cronograma');
    const reprocesos = por('reproceso'), pausas = por('pausa');
    const notas     = por('nota');
    const proyectos = [...new Set(sel.map(e => e.proj))].sort((a, b) => a.localeCompare(b));
    const ops       = new Set(sel.map(e => e.op.id));

    const tile = (n, l) => `<div class="nv-tile"><b>${n}</b><span>${l}</span></div>`;
    const lista = (arr, fmt) => arr.length
      ? arr.map(e => `<div class="nv-li">${fmt(e)}</div>`).join('')
      : '';
    const seccion = (titulo, arr, fmt) => arr.length ? `<div class="nv-h2">${titulo}</div>${lista(arr, fmt)}` : '';

    const resumen = `
      <div class="nv-tiles">
        ${tile(proyectos.length, 'Proyectos con actividad')}
        ${tile(completas.length, 'OPs completadas')}
        ${tile(cron.length, 'Cambios de cronograma')}
        ${tile(reprocesos.length + pausas.length, 'Reprocesos / pausas')}
        ${tile(notas.length, 'Comentarios')}
      </div>
      ${seccion('✔ Completadas', completas, e => `${opLbl(e)} <small>— ${esc(e.proj)} · ${this._fmtFecha(e.ts)}</small>`)}
      ${seccion('📅 Cronogramas que se movieron', cron, e => `${opLbl(e)} <small>— ${esc(e.proj)}</small><br>${esc(e.text)}${e.sub ? ` <small>(${esc(e.sub)})</small>` : ''}`)}
      ${seccion('⚠ Reprocesos y pausas', [...reprocesos, ...pausas].sort((a, b) => a.ts - b.ts), e => `${opLbl(e)} <small>— ${esc(e.proj)} · ${this._fmtFecha(e.ts)}</small><br>${esc(e.text)}`)}
    `;

    const bloques = proyectos.map(p => {
      const items = sel.filter(e => e.proj === p);
      return `
        <div class="nv-proj">
          <div class="nv-proj-h">${esc(p)}<span>${items.length} ${items.length !== 1 ? 'actualizaciones' : 'actualización'}</span></div>
          ${items.map(e => `
            <div class="nv-row">
              <div class="nv-d">${this._fmtFecha(e.ts)}</div>
              <div class="nv-i">${e.icon}</div>
              <div class="nv-t">${opLbl(e)}<br>${esc(e.text)}${e.sub ? `<div class="nv-sub">${esc(e.sub)}</div>` : ''}${e.foto ? `<img class="nv-foto" src="${esc(e.foto)}" alt="Foto">` : ''}</div>
            </div>`).join('')}
        </div>`;
    }).join('');

    return `
<div class="nv-sheet">
  <div class="nv-title">
    <h1>Resumen de actualizaciones — Instalación</h1>
    <div class="nv-per">${per}<br>Generado el ${f(hoy)}</div>
  </div>
  ${sel.length ? resumen : '<div class="nv-vacio">No hay actualizaciones registradas en este periodo.</div>'}
  ${sel.length ? `<div class="nv-detalle"><div class="nv-h2" style="margin-top:0">Detalle por proyecto · ${ops.size} OP${ops.size !== 1 ? 's' : ''} con movimiento</div>${bloques}</div>` : ''}
  <div class="nv-foot">Wood Concept · Instalación</div>
</div>`;
  },

  _print() {
    const data = this._collect();
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Resumen de actualizaciones — Instalación</title>
<style>@page{size:letter portrait;margin:0.6in 0.7in} body{margin:0} ${this._docCss()} .nv-sheet{padding:0}</style></head>
<body>${this._docHtml(data)}</body></html>`;
    const win = window.open('', '_blank', 'width=900,height=800');
    if (!win) { alert('Permite ventanas emergentes para imprimir.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    try { localStorage.setItem(this._LS, new Date().toISOString()); } catch {}
    this._refreshOpciones();
    const pend = [...win.document.images].map(im => im.complete ? null : new Promise(r => { im.onload = r; im.onerror = r; }));
    Promise.race([Promise.all(pend), new Promise(r => setTimeout(r, 20000))]).then(() => setTimeout(() => win.print(), 300));
  },

  // ── Interfaz ─────────────────────────────────────────────────
  _ensureCss() {
    if (document.getElementById('nv-css')) return;
    const st = document.createElement('style');
    st.id = 'nv-css';
    st.textContent = `
.nv-ov{position:fixed;inset:0;z-index:9000;background:rgba(20,16,12,.55);overflow:auto;-webkit-overflow-scrolling:touch}
.nv-card{background:#faf8f5;width:100%;max-width:980px;margin:0 auto;min-height:100%}
.nv-hdr{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#1a1714;color:#fff;font-weight:600}
.nv-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;padding:0 6px}
.nv-body{padding:14px 16px}
.nv-ctl{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px}
.nv-ctl label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:#6b645c}
.nv-ctl select,.nv-ctl input[type=date]{font-size:15px;padding:7px 9px;border:1px solid #d8d2cb;border-radius:7px;background:#fff}
.nv-projbox{border:1px solid #d8d2cb;border-radius:8px;background:#fff;padding:8px 12px;margin-bottom:10px;font-size:13px}
.nv-projbox summary{cursor:pointer;font-weight:600}
.nv-projbox label{display:flex;gap:8px;align-items:center;padding:5px 0;cursor:pointer}
.nv-warn{font-size:13px;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:8px 12px;margin-bottom:10px}
#nv-prev{overflow:auto;background:#e9e4dc;padding:12px;border-radius:8px}
#nv-prev .nv-sheet{max-width:780px;margin:0 auto;box-shadow:0 1px 6px rgba(0,0,0,.2)}
` + this._docCss();
    document.head.appendChild(st);
  },

  _build() {
    this.close();
    const ov = document.createElement('div');
    ov.className = 'nv-ov';
    ov.id = 'nv-overlay';
    ov.innerHTML = `
<div class="nv-card">
  <div class="nv-hdr"><span>🔔 Actualizaciones de los proyectos</span><button class="nv-x" data-a="close" title="Cerrar">✕</button></div>
  <div class="nv-body">
    <div class="nv-ctl">
      <label>Periodo
        <select id="nv-periodo" data-f="periodo"></select>
      </label>
      <span id="nv-rango" style="display:none;gap:8px;align-items:flex-end">
        <label>Desde <input type="date" data-f="desde"></label>
        <label>Hasta <input type="date" data-f="hasta"></label>
      </span>
      <button class="btn-primary" data-a="print">🖨 Imprimir informe</button>
    </div>
    <div id="nv-warn"></div>
    <details class="nv-projbox" id="nv-projbox"><summary id="nv-projsum">Proyectos</summary><div id="nv-projlist"></div></details>
    <div id="nv-prev"><div class="nv-vacio">Cargando…</div></div>
  </div>
</div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    this._refreshOpciones();

    ov.addEventListener('change', async e => {
      const t = e.target;
      if (t.dataset?.f === 'periodo') {
        this._periodo = t.value;
        document.getElementById('nv-rango').style.display = this._periodo === 'rango' ? 'flex' : 'none';
        await this._cargarCambios();
        this._refresh();
      } else if (t.dataset?.f === 'desde' || t.dataset?.f === 'hasta') {
        this['_' + t.dataset.f] = t.value;
        await this._cargarCambios();
        this._refresh();
      } else if (t.dataset?.proj !== undefined) {
        if (t.checked) this._excluir.delete(t.dataset.proj); else this._excluir.add(t.dataset.proj);
        this._refresh(true);
      }
    });
    ov.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'close') this.close();
      else if (a === 'print') this._print();
      else if (a === 'todos')   { this._excluir.clear(); this._refresh(); }
      else if (a === 'ninguno') { this._projNombres().forEach(p => this._excluir.add(p)); this._refresh(); }
    });
  },

  _refreshOpciones() {
    const sel = document.getElementById('nv-periodo');
    if (!sel) return;
    const ult = this._ultimaImpresion();
    const f = d => `${this._fmtFecha(d)}, ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    sel.innerHTML = `
      <option value="ultima">Desde la última impresión${ult ? ` (${f(ult)})` : ' (aún no hay: usa 7 días)'}</option>
      <option value="7">Últimos 7 días</option>
      <option value="14">Últimos 14 días</option>
      <option value="30">Últimos 30 días</option>
      <option value="rango">Rango de fechas…</option>`;
    sel.value = this._periodo;
  },

  _projNombres() {
    return [...new Set(this._collect().ev.map(e => e.proj))].sort((a, b) => a.localeCompare(b));
  },

  _refresh(soloVista) {
    const data = this._collect();
    const warn = document.getElementById('nv-warn');
    if (warn) {
      warn.innerHTML = this._cambiosErr
        ? '<div class="nv-warn">⚠ Todavía no se registran los cambios de días, fechas, avance e instaladores: falta crear la tabla <b>cambios_instalacion</b> en Supabase (SQL pendiente). Mientras tanto el informe solo muestra comentarios, inicios, pausas y reprocesos de la bitácora.</div>'
        : '';
    }
    if (!soloVista) {
      const nombres = [...new Set(data.ev.map(e => e.proj))].sort((a, b) => a.localeCompare(b));
      const cuenta = p => data.ev.filter(e => e.proj === p).length;
      const list = document.getElementById('nv-projlist');
      if (list) {
        list.innerHTML = nombres.length
          ? `<div style="margin:4px 0 6px"><button class="acta-link nv-link" data-a="todos" style="background:none;border:0;color:#8B1A1A;text-decoration:underline;cursor:pointer">Todos</button> · <button class="nv-link" data-a="ninguno" style="background:none;border:0;color:#8B1A1A;text-decoration:underline;cursor:pointer">Ninguno</button></div>` +
            nombres.map(p => `<label><input type="checkbox" data-proj="${esc(p)}" ${this._excluir.has(p) ? '' : 'checked'}> ${esc(p)} <span style="color:#888">(${cuenta(p)})</span></label>`).join('')
          : '<div style="color:#888;padding:4px 0">Sin actividad en este periodo.</div>';
      }
      const sum = document.getElementById('nv-projsum');
      if (sum) {
        const n = nombres.filter(p => !this._excluir.has(p)).length;
        sum.innerHTML = `Proyectos: <b>${n === nombres.length ? 'todos' : n + ' de ' + nombres.length}</b> (${nombres.length} con actividad)`;
      }
    } else {
      const nombres = [...new Set(data.ev.map(e => e.proj))];
      const sum = document.getElementById('nv-projsum');
      if (sum) { const n = nombres.filter(p => !this._excluir.has(p)).length; sum.innerHTML = `Proyectos: <b>${n === nombres.length ? 'todos' : n + ' de ' + nombres.length}</b> (${nombres.length} con actividad)`; }
    }
    const prev = document.getElementById('nv-prev');
    if (prev) prev.innerHTML = this._docHtml(data);
  },
};
