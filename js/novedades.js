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
  _periodo:  'hoy',          // 'hoy' | '7' | '14' | '30' | 'rango'
  _desde:    '',
  _hasta:    '',
  _excluir:  new Set(),      // proyectos que se quitan del informe
  _abiertas: new Set(),      // OPs con la lista de cambios desplegada completa (solo en pantalla; al imprimir siempre salen todos)
  _cambios:  [],
  _cambiosErr: null,
  _LS:       'wi_novedades_ultima',
  _MESES:    ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],

  // ── Entrada ──────────────────────────────────────────────────
  open() {
    this._ensureCss();
    this._excluir = new Set();
    this._abiertas = new Set();
    this._periodo = 'hoy';
    this._desde = this._hasta = '';
    this._build();
    this._cargarCambios().then(() => this._refresh());
  },

  close() {
    document.getElementById('nv-lightbox')?.remove();
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
    if (this._periodo === 'hoy') {
      from = new Date(); from.setHours(0, 0, 0, 0);   // desde las 12:00 a. m. de hoy
    } else {
      from = new Date(Date.now() - parseInt(this._periodo, 10) * 86400000);
    }
    return { from, to };
  },

  // Siempre se piden a la base: así un cambio hecho después de abrir el informe por primera vez también aparece.
  async _cargarCambios() {
    const { from } = this._range();
    try {
      this._cambios = await DB.getCambios(from.toISOString());
      this._cambiosErr = null;
    } catch (e) {
      this._cambios = [];
      this._cambiosErr = e.message || String(e);
    }
  },

  // Une las ediciones seguidas del mismo campo de una OP en el mismo día
  // (p. ej. retoques 0→1, 0→2, 2→3 pasan a "0 → 3"). Si el resultado es el
  // mismo valor del inicio, no se muestra. Instaladores no se unen.
  _mergeCambios(lista) {
    const UNIBLES = new Set(['dias_estimados', 'dias_retoques', 'fecha_inicio_plan', 'fecha_inicio_retoques', 'porcentaje', 'estatus_instalacion', 'fecha_envio', 'fecha_inicio', 'fecha_fin']);
    const dia = c => { const d = new Date(c.created_at); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const finDesde = d => { const m = d && d.match(/fin est\. (.+?) → /); return m ? m[1] : null; };
    const finHasta = d => { if (!d) return null; let m = d.match(/fin est\. .+? → (.+)$/); if (m) return m[1]; m = d.match(/fin est\. (.+)$/); return m ? m[1] : null; };
    const inicioDe = d => { const m = d && d.match(/^(inicio [^·]+?) · /); return m ? m[1] : null; };
    const grupos = new Map();
    const salida = [];
    lista.forEach(c => {
      if (!UNIBLES.has(c.campo)) { salida.push({ ...c, ids: [c.id] }); return; }
      const k = `${c.op_id}|${c.campo}|${dia(c)}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(c);
    });
    grupos.forEach(g => {
      const primero = g[0], ultimo = g[g.length - 1];
      if (g.length === 1) { salida.push({ ...ultimo, ids: [ultimo.id] }); return; }
      if ((primero.anterior ?? null) === (ultimo.nuevo ?? null)) return;   // quedó igual que al inicio
      let detalle = null;
      const ini = inicioDe(primero.detalle), hasta = finHasta(ultimo.detalle);
      if (ini && hasta) detalle = `${ini} · fin est. ${hasta}`;
      else if (finDesde(primero.detalle) && hasta) detalle = `fin est. ${finDesde(primero.detalle)} → ${hasta}`;
      salida.push({ ...ultimo, anterior: primero.anterior, detalle, ids: g.map(x => x.id) });
    });
    return salida.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  },

  // ── Eventos ──────────────────────────────────────────────────
  _fmtFecha(d) { return `${d.getDate()} ${this._MESES[d.getMonth()]}`; },

  _fmtVal(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-').map(Number); return `${d} ${this._MESES[m - 1]}`; }
    return v;
  },

  _tiene(v) { return v !== null && v !== undefined && v !== ''; },

  _dias(v) { const n = Number(v); return `${v} día${n === 1 ? '' : 's'}`; },

  // Convierte un registro de cambios en algo entendible: una etiqueta ("Estatus"), el valor de ANTES (solo si
  // existía: si no, queda null y no se muestra) y el valor de DESPUÉS.
  _describirCambio(c) {
    const T = v => this._tiene(v);
    const a = T(c.anterior) ? this._fmtVal(c.anterior) : null;
    const n = T(c.nuevo) ? this._fmtVal(c.nuevo) : '—';
    const det = c.detalle || null;
    const mk = (kind, icon, etiqueta, antes, despues) => ({
      kind, icon, etiqueta, antes, despues, sub: det,
      text: `${etiqueta}: ${antes ? antes + ' → ' : ''}${despues}`,
    });
    switch (c.campo) {
      case 'dias_estimados':
        return mk('cronograma', '📅', 'Días de instalación', T(c.anterior) ? this._dias(c.anterior) : null, T(c.nuevo) ? this._dias(c.nuevo) : '—');
      case 'dias_retoques':
        return mk('cronograma', '📅', 'Días de retoques', T(c.anterior) ? this._dias(c.anterior) : null, T(c.nuevo) ? this._dias(c.nuevo) : '—');
      case 'fecha_inicio_plan':
        return mk('cronograma', '📅', 'Inicio del cronograma', a, n);
      case 'fecha_inicio_retoques':
        return mk('cronograma', '📅', 'Inicio de retoques', a, n);
      case 'fecha_envio':   return mk('fecha', '🚚', 'Envío a sitio', a, n);
      case 'fecha_inicio':  return mk('fecha', '▶',  'Inicio de instalación', a, n);
      case 'fecha_fin':     return mk('fecha', '🏁', 'Fin de instalación', a, n);
      case 'porcentaje':    return mk('avance', '📊', 'Avance', T(c.anterior) ? c.anterior + '%' : null, T(c.nuevo) ? c.nuevo + '%' : '—');
      case 'estatus_instalacion':
        return mk('estatus', '📊', 'Estatus', a, n);
      case 'instalador_agregado':
        return mk('instalador', '👷', 'Instalador asignado', null, n);
      case 'instalador_quitado':
        return mk('instalador', '👷', 'Instalador retirado', null, T(c.anterior) ? this._fmtVal(c.anterior) : '—');
      case 'estado':
        return mk('completa', '✔', 'Estado', null, 'OP completada');
      default:
        return mk('otro', '•', String(c.campo), a, n);
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
    (Instalacion._dbData?.bitacoraInstalacion || []).forEach(e => push(new Date(e.created_at), e.op_id, { key: 'b:' + e.id, grupo: 'nota', ...this._describirBitacora(e) }));
    this._mergeCambios(this._cambios).forEach(c => push(new Date(c.created_at), c.op_id, { key: 'c:' + c.ids.join(','), grupo: 'cambio', ...this._describirCambio(c) }));
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
.nv-op{border:1px solid #cfc8bf;border-left:5px solid #8B1A1A;border-radius:4px;padding:10px 12px 8px;margin:12px 0 0;background:#fff;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.nv-op-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;padding-bottom:7px;margin-bottom:8px;border-bottom:1.5px solid #8B1A1A}
.nv-op-n{font-size:10.5pt}
.nv-op-n b{color:#8B1A1A}
.nv-chip{font-size:8pt;background:#f1ede7;color:#555;padding:1px 8px;border-radius:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.nv-now{font-size:8.5pt;color:#666;margin:2px 0 7px}
.nv-com{display:flex;gap:8px;background:#f5f2ed;border-radius:6px;padding:6px 10px;margin:0 0 6px;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.nv-com-b{flex:1;min-width:0}
.nv-com-h{font-size:8pt;color:#777}
.nv-com-t{font-size:9.5pt;line-height:1.45;white-space:pre-wrap}
.nv-tab{width:100%;border-collapse:collapse;font-size:9pt;margin-top:2px}
.nv-tab th{font-weight:400;font-size:8pt;color:#888;text-align:left;padding:2px 4px}
.nv-tab td{padding:4px 4px;border-top:.5pt solid #e5e0da;vertical-align:top}
.nv-tab tr{break-inside:avoid}
.nv-tf{width:46px;color:#666;white-space:nowrap}
.nv-tc{width:34%}
.nv-tx{width:22px;text-align:right}
.nv-antes{color:#888}
.nv-flecha{color:#aaa;margin:0 5px}
.nv-val{font-weight:600;color:#111}
.nv-mas{background:none;border:0;color:#8B1A1A;font-size:9pt;cursor:pointer;padding:6px 0 0;text-decoration:underline}
.nv-plegada .nv-extra{display:none}
@media print{.nv-mas{display:none}}
`;
  },

  // "Antes → Después" si había un antes; solo el valor nuevo si no lo había.
  _valorHtml(e) {
    if (e.despues === undefined) return esc(e.text || '');
    return this._tiene(e.antes)
      ? `<span class="nv-antes">${esc(e.antes)}</span><span class="nv-flecha">→</span><b class="nv-val">${esc(e.despues)}</b>`
      : `<b class="nv-val">${esc(e.despues)}</b>`;
  },

  // Una tarjeta por OP: título una sola vez, sus comentarios y una tabla con todos sus cambios.
  // En pantalla, si hay más de 4 cambios se ven los 4 más recientes y un "Ver los N cambios anteriores";
  // al imprimir siempre salen todos.
  _opCardHtml(list, editable) {
    const MAX = 4;
    const op = list[0].op;
    const notas   = list.filter(e => e.grupo === 'nota').sort((a, b) => b.ts - a.ts);
    const cambios = list.filter(e => e.grupo !== 'nota').sort((a, b) => b.ts - a.ts);
    const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
    const resumen = [cambios.length ? plural(cambios.length, 'cambio', 'cambios') : '', notas.length ? plural(notas.length, 'comentario', 'comentarios') : ''].filter(Boolean).join(' · ');
    const del = e => editable ? `<button class="nv-del" data-del="${esc(e.key)}" title="Quitar del informe">✕</button>` : '';

    const coms = notas.map(e => `
        <div class="nv-com">
          <div class="nv-com-b">
            <div class="nv-com-h">${e.icon} ${this._fmtFecha(e.ts)}</div>
            <div class="nv-com-t">${esc(e.text)}</div>
            ${e.foto ? `<img class="nv-foto" src="${esc(e.foto)}" alt="Foto">` : ''}
          </div>
          ${del(e)}
        </div>`).join('');

    const plegable = editable && cambios.length > MAX;
    const abierta = this._abiertas.has(op.id);
    const filas = cambios.map((e, i) => `
          <tr${plegable && i >= MAX ? ' class="nv-extra"' : ''}>
            <td class="nv-tf">${this._fmtFecha(e.ts)}</td>
            <td class="nv-tc">${e.icon} ${esc(e.etiqueta || e.text)}</td>
            <td class="nv-tv">${this._valorHtml(e)}${e.sub ? `<div class="nv-sub">${esc(e.sub)}</div>` : ''}</td>
            ${editable ? `<td class="nv-tx">${del(e)}</td>` : ''}
          </tr>`).join('');
    const tabla = cambios.length
      ? `<table class="nv-tab"><thead><tr><th>Fecha</th><th>Cambio</th><th>Detalle</th>${editable ? '<th></th>' : ''}</tr></thead><tbody>${filas}</tbody></table>`
      : '';
    const mas = plegable
      ? `<button class="nv-mas" data-a="mas" data-op="${esc(op.id)}">${abierta ? 'Ocultar los cambios anteriores' : `Ver los ${cambios.length - MAX} cambios anteriores`}</button>`
      : '';
    return `
      <div class="nv-op${plegable && !abierta ? ' nv-plegada' : ''}">
        <div class="nv-op-h"><div class="nv-op-n"><b>${esc(op.noOp || '—')}</b> · ${esc(op.name)}</div><span class="nv-chip">${resumen}</span></div>
        ${coms}${tabla}${mas}
      </div>`;
  },

  _docHtml(data, editable = false) {
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
    // Lo más reciente arriba: los proyectos con movimiento más nuevo primero y, dentro de cada uno, la actualización más nueva primero.
    const ultimo = {};
    sel.forEach(e => { if (!ultimo[e.proj] || e.ts > ultimo[e.proj]) ultimo[e.proj] = e.ts; });
    const proyectos = Object.keys(ultimo).sort((a, b) => ultimo[b] - ultimo[a]);
    const ops       = new Set(sel.map(e => e.op.id));

    const tile = (n, l) => `<div class="nv-tile"><b>${n}</b><span>${l}</span></div>`;
    const resumen = `
      <div class="nv-tiles">
        ${tile(proyectos.length, 'Proyectos con actividad')}
        ${tile(completas.length, 'OPs completadas')}
        ${tile(cron.length, 'Cambios de cronograma')}
        ${tile(reprocesos.length + pausas.length, 'Reprocesos / pausas')}
        ${tile(notas.length, 'Comentarios')}
      </div>
    `;

    // Por proyecto → una tarjeta por OP (la de movimiento más reciente primero), con todos sus cambios dentro.
    const bloques = proyectos.map(p => {
      const delProyecto = sel.filter(e => e.proj === p);
      const porOp = new Map();
      delProyecto.forEach(e => { if (!porOp.has(e.op.id)) porOp.set(e.op.id, []); porOp.get(e.op.id).push(e); });
      const tarjetas = [...porOp.values()]
        .sort((a, b) => Math.max(...b.map(x => x.ts)) - Math.max(...a.map(x => x.ts)));
      return `
        <div class="nv-proj">
          <div class="nv-proj-h">${esc(p)}<span>${tarjetas.length} OP${tarjetas.length !== 1 ? 's' : ''} · ${delProyecto.length} ${delProyecto.length !== 1 ? 'actualizaciones' : 'actualización'}</span></div>
          ${tarjetas.map(l => this._opCardHtml(l, editable)).join('')}
        </div>`;
    }).join('');

    return `
<div class="nv-sheet">
  <div class="nv-title">
    <h1>Resumen de actualizaciones — Instalación</h1>
    <div class="nv-per">${per}<br>Generado el ${f(hoy)}</div>
  </div>
  ${sel.length ? resumen : '<div class="nv-vacio">No hay actualizaciones registradas en este periodo.</div>'}
  ${sel.length ? `<div class="nv-detalle"><div class="nv-h2">Detalle por proyecto · ${ops.size} OP${ops.size !== 1 ? 's' : ''} con movimiento</div>${bloques}</div>` : ''}
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
#nv-prev .nv-foto{cursor:zoom-in}
.nv-lb{position:fixed;inset:0;z-index:9500;background:rgba(10,8,6,.9);display:flex;align-items:center;justify-content:center;cursor:zoom-out}
.nv-lb img{max-width:94vw;max-height:88vh;object-fit:contain;border-radius:4px;box-shadow:0 4px 30px rgba(0,0,0,.6)}
.nv-lb-x{position:absolute;top:10px;right:14px;background:none;border:0;color:#fff;font-size:30px;cursor:pointer;line-height:1}
.nv-lb-a{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);color:#ddd;font-size:13px;text-decoration:underline}
.nv-del{flex:none;align-self:flex-start;background:none;border:0;color:#b5aca0;font-size:14px;cursor:pointer;padding:0 4px;line-height:1}
.nv-del:hover{color:#b91c1c}
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
      if (e.target.classList?.contains('nv-foto')) { this._verFoto(e.target.src); return; }
      const del = e.target.closest('[data-del]')?.dataset.del;
      if (del) { this._quitar(del); return; }
      const btn = e.target.closest('[data-a]');
      const a = btn?.dataset.a;
      if (a === 'close') this.close();
      else if (a === 'print') this._print();
      else if (a === 'mas') {
        const id = btn.dataset.op;
        if (this._abiertas.has(id)) this._abiertas.delete(id); else this._abiertas.add(id);
        this._refresh(true);
      }
      else if (a === 'todos')   { this._excluir.clear(); this._refresh(); }
      else if (a === 'ninguno') { this._projNombres().forEach(p => this._excluir.add(p)); this._refresh(); }
    });
  },

  _refreshOpciones() {
    const sel = document.getElementById('nv-periodo');
    if (!sel) return;
    sel.innerHTML = `
      <option value="hoy">Hoy</option>
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
    if (prev) prev.innerHTML = this._docHtml(data, true);
  },

  // Visor de fotos: se abre al hacer clic en una foto de la vista previa.
  _verFoto(src) {
    document.getElementById('nv-lightbox')?.remove();
    const lb = document.createElement('div');
    lb.className = 'nv-lb';
    lb.id = 'nv-lightbox';
    lb.innerHTML = `<button class="nv-lb-x" title="Cerrar">✕</button><img src="${esc(src)}" alt="Foto"><a class="nv-lb-a" href="${esc(src)}" target="_blank" rel="noopener">Abrir original en otra pestaña</a>`;
    const cerrar = () => { lb.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => {
      if (!lb.isConnected) { document.removeEventListener('keydown', onKey, true); return; }
      if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
    };
    lb.addEventListener('click', e => { if (!e.target.closest('.nv-lb-a')) cerrar(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(lb);
  },

  // Quita una actualización del informe: un cambio registrado se borra del
  // registro (el cambio en sí no se deshace); una nota de la bitácora se borra de la bitácora.
  async _quitar(key) {
    const [tipo, id] = [key.slice(0, 1), key.slice(2)];
    try {
      if (tipo === 'c') {
        if (!confirm('¿Quitar este cambio del informe?\n\nSolo se borra del registro de actualizaciones: el cambio en sí (los días, la fecha, etc.) no se deshace.')) return;
        const ids = id.split(',');   // un renglón puede juntar varias ediciones seguidas
        for (const x of ids) await DB.deleteCambio(x);
        this._cambios = this._cambios.filter(c => !ids.includes(c.id));
      } else {
        if (!confirm('Esta actualización es una nota de la bitácora de la OP.\n\n¿Borrarla? Desaparece también de la bitácora de la OP y no se puede deshacer.')) return;
        const entry = (Instalacion._dbData?.bitacoraInstalacion || []).find(e => e.id === id);
        await DB.deleteBitacoraEntry(id);
        if (entry?.foto_url) await DB.deleteFotoByUrl(entry.foto_url);
        Instalacion._dbData.bitacoraInstalacion = Instalacion._dbData.bitacoraInstalacion.filter(e => e.id !== id);
        Instalacion._draw();
      }
      this._refresh();
    } catch (e) { alert('No se pudo quitar: ' + (e.message || e)); }
  },
};
