// ─────────────────────────────────────────────────────────────
// js/instalacion.js — Bitácora de Instalación
//
// Coordinador de instalaciones: qué OPs ya están en empaque (listas
// para enviar a sitio) y cuáles están en instalación ahora mismo, con
// un log de eventos (inicio/pausa/cambio en sitio/reproceso/fin) y
// comentarios por OP — reemplaza la ficha Excel manual.
// ─────────────────────────────────────────────────────────────

const Instalacion = {
  _ops:           [],
  _dbData:        null,
  _fieldIds:      {},
  _instaladores:  [],
  _sub:           'instalacion',   // 'empaque' | 'instalacion' | 'rendimiento'
  _expanded:      new Set(),       // op ids showing the bitácora panel
  _draftTipo:     {},              // op_id → selected tipo in the compose form
  _draftTexto:    {},              // op_id → draft comment text
  _draftFoto:     {},              // op_id → uploaded photo URL, staged for the next Guardar
  _fotoUploading: {},              // op_id → true while a photo upload is in flight
  _editingEntry:  null,            // bitácora entry id being edited inline
  _editDraft:     { tipo: 'nota', texto: '' },
  _ganttOpen:     new Set(),       // project names showing the projected Gantt
  _searchQuery:   '',              // "En Instalación" search box value
  _DEFAULT_DIAS_ESTIMADOS: 2,
  _DEFAULT_DIAS_RETOQUES: 0,       // 0 = sin etapa de retoques en el cronograma, por defecto
  _DIAS_LIMPIEZA: 4,

  render({ installOps, fieldIds, dbData }) {
    this._ops          = installOps || [];
    this._fieldIds      = fieldIds || {};
    // The dropdown is built from Supabase (dbData.instaladores), not
    // ClickUp — the ClickUp INSTALADORES field only has ~10 options and
    // its API can't add more. fieldIds.instaladorOpts (still from
    // ClickUp) is used separately, only to mirror a name back when it
    // happens to already exist as a ClickUp option.
    this._instaladores = (dbData?.instaladores || []).map(r => r.nombre);
    this._dbData        = dbData;
    this._draw();
  },

  // ── Helpers ─────────────────────────────────────────────────

  _fmtShort(d) {
    if (!d) return '';
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  },

  // Date → 'YYYY-MM-DD' in local time (what <input type="date"> uses).
  _isoDate(d) {
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  _instaladoresFor(opId) {
    return (this._dbData?.asignaciones || [])
      .filter(a => a.op_id === opId && a.etapa === 'instalacion')
      .map(a => a.persona);
  },

  _installRow(opId) {
    return (this._dbData?.instalacionOps || []).find(r => r.op_id === opId) || null;
  },

  _bitacoraFor(opId) {
    return (this._dbData?.bitacoraInstalacion || [])
      .filter(e => e.op_id === opId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  _groupByProject(ops) {
    const map = new Map();
    for (const op of ops) {
      const proj = op.project || '(Sin proyecto)';
      if (!map.has(proj)) map.set(proj, []);
      map.get(proj).push(op);
    }
    return map;
  },

  // ── Draw ─────────────────────────────────────────────────────

  _draw() {
    const wrap = el('instalacion-container');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="tab-wrap">
        <div class="asign-header-row">
          <h2 class="tab-title">🚚 Bitácora de Instalación</h2>
          <p class="tab-sub">OPs que ya salieron de fábrica: listas para enviar (empaque) y en instalación en sitio.</p>
        </div>
        <div class="cron-subtabs">
          <button class="cron-subtab ${this._sub === 'empaque' ? 'active' : ''}" data-sub="empaque">📦 Empaque (${this._ops.filter(o => o.status === 'empaque').length})</button>
          <button class="cron-subtab ${this._sub === 'instalacion' ? 'active' : ''}" data-sub="instalacion">🔧 En Instalación (${this._ops.filter(o => o.status === 'en instalacion').length})</button>
          <button class="cron-subtab ${this._sub === 'rendimiento' ? 'active' : ''}" data-sub="rendimiento">📊 Rendimiento</button>
        </div>
        <div class="cron-body" id="inst-body">
          ${this._sub === 'empaque' ? this._renderEmpaque()
            : this._sub === 'rendimiento' ? this._renderRendimiento()
            : this._renderEnInstalacion()}
        </div>
      </div>
    `;

    wrap.querySelectorAll('.cron-subtab').forEach(btn => {
      btn.addEventListener('click', () => { this._sub = btn.dataset.sub; this._draw(); });
    });

    this._bindEmpaque(wrap);
    this._bindInstalacion(wrap);
    this._bindSearch(wrap);
  },

  // ── 📦 Empaque (ready to ship) ───────────────────────────────

  _renderEmpaque() {
    const ops = this._ops.filter(o => o.status === 'empaque');
    if (!ops.length) return '<div class="cron-empty">No hay OPs en empaque en este momento.</div>';

    const groups = this._groupByProject(ops);
    return [...groups.entries()].map(([project, projOps]) => `
      <div class="cron-block">
        <div class="cron-block-hdr">
          <span class="cron-hdr-name">${esc(project)}</span>
          <span class="cron-hdr-meta"><span class="cron-hdr-count">${projOps.length} OP${projOps.length !== 1 ? 's' : ''}</span></span>
        </div>
        <table class="cron-tbl">
          <thead><tr><th>No. OP</th><th>Descripción</th><th>Fecha empaque</th><th>Envío a sitio</th><th></th></tr></thead>
          <tbody>
            ${projOps.map(op => `
              <tr>
                <td data-label="No. OP">${op.noOp ? `<span class="cron-op-num">${esc(op.noOp)}</span>` : '<span class="cron-faint">—</span>'}</td>
                <td class="cron-name" data-label="Descripción">${esc(op.name)}</td>
                <td class="cron-fecha-lbl" data-label="Fecha empaque">${op.fechaEmpaque ? this._fmtShort(op.fechaEmpaque) : '<span class="cron-faint">—</span>'}</td>
                <td class="cron-fecha-lbl" data-label="Envío a sitio">${op.envioInstalacion ? this._fmtShort(op.envioInstalacion) : '<span class="cron-faint">—</span>'}</td>
                <td>${op.envioInstalacion ? '' : `<button class="btn-secondary btn-sm inst-btn-enviar" data-op="${esc(op.id)}">📤 Marcar enviada hoy</button>`}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');
  },

  // Same pattern as fábrica's Asignación search: filters by toggling
  // display, no full re-render — keeps focus/cursor in the box while typing.
  _bindSearch(wrap) {
    const input = wrap.querySelector('#inst-search');
    if (!input) return;
    const apply = () => {
      const q = input.value.toLowerCase().trim();
      this._searchQuery = input.value;
      wrap.querySelectorAll('.inst-op-card').forEach(card => {
        card.style.display = (!q || (card.dataset.search || '').includes(q)) ? '' : 'none';
      });
      wrap.querySelectorAll('.cron-block').forEach(block => {
        const cards = [...block.querySelectorAll('.inst-op-card')];
        if (!cards.length) return; // not an OP-card block (e.g. Empaque table) — leave alone
        block.style.display = cards.some(c => c.style.display !== 'none') ? '' : 'none';
      });
    };
    input.addEventListener('input', apply);
    if (this._searchQuery) apply();
  },

  _bindEmpaque(wrap) {
    wrap.querySelectorAll('.inst-btn-enviar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const opId = btn.dataset.op;
        const op = this._ops.find(o => o.id === opId);
        if (!op || !this._fieldIds.envioInstalacion) return;
        btn.disabled = true; btn.textContent = '...';
        try {
          await PlantaAPI.setField(opId, this._fieldIds.envioInstalacion, Date.now());
          op.envioInstalacion = new Date();
          PlantaAPI.clearCache();
          this._draw();
        } catch (e) {
          alert('Error: ' + e.message);
          btn.disabled = false; btn.textContent = '📤 Marcar enviada hoy';
        }
      });
    });
  },

  // ── 🔧 En instalación ─────────────────────────────────────────

  _renderEnInstalacion() {
    const ops = this._ops.filter(o => o.status === 'en instalacion');
    if (!ops.length) return '<div class="cron-empty">No hay OPs en instalación en este momento.</div>';

    const searchBar = `
      <div class="asign-search-wrap">
        <input type="search" id="inst-search" class="asign-search-input"
          placeholder="Buscar proyecto o número de OP..." value="${esc(this._searchQuery)}">
      </div>
    `;

    const groups = this._groupByProject(ops);
    const blocks = [...groups.entries()].map(([project, projOps]) => `
      <div class="cron-block">
        <div class="cron-block-hdr">
          <span class="cron-hdr-name">${esc(project)}</span>
          <span class="cron-hdr-meta">
            <span class="cron-hdr-count">${projOps.length} OP${projOps.length !== 1 ? 's' : ''}</span>
            <button class="btn-secondary btn-sm inst-gantt-toggle" data-proj="${esc(project)}">📅 Cronograma</button>
            <button class="btn-secondary btn-sm inst-print-btn" data-proj="${esc(project)}" title="Imprimir resumen de instalación de ${esc(project)}">🖨 Imprimir</button>
          </span>
        </div>
        ${this._ganttOpen.has(project) ? this._ganttHtml(project, projOps) : ''}
        ${projOps.map(op => this._opCardHtml(op)).join('')}
      </div>
    `).join('');

    return searchBar + blocks;
  },

  // ── 📅 Cronograma proyectado (secuencial, tipo Gantt) ────────
  //
  // Cada OP se proyecta por separado: empieza en su fecha real de inicio
  // de instalación (u hoy, si todavía no tiene) y dura sus días estimados
  // hábiles. Si tiene días de Retoques, esa etapa va justo después.
  // Termina con un buffer general de "limpieza" del proyecto completo,
  // contado desde la OP que termina más tarde.

  _addBusinessDays(date, days) {
    const d = new Date(date);
    let added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return d;
  },

  // Each OP is projected on its own: it starts on its real "inicio de
  // instalación" date, or today if it hasn't started yet, and ends after
  // its estimated business days (+ retoques). E.g. no inicio + 3 días
  // on Tue 6 oct → fin estimado Fri 9 oct.
  _projectedSchedule(projOps) {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const items = [];
    let lastFinish = today;
    for (const op of projOps) {
      const row          = this._installRow(op.id);
      const dias         = row?.dias_estimados ?? this._DEFAULT_DIAS_ESTIMADOS;
      const diasRetoques = row?.dias_retoques  ?? this._DEFAULT_DIAS_RETOQUES;

      const start  = op.inicioInstalacion ? new Date(op.inicioInstalacion) : new Date(today);
      start.setHours(12, 0, 0, 0);
      const finish = this._addBusinessDays(start, dias);

      let retoquesStart = null, retoquesFinish = null;
      if (diasRetoques > 0) {
        retoquesStart  = new Date(finish);
        retoquesFinish = this._addBusinessDays(retoquesStart, diasRetoques);
      }

      const end = retoquesFinish || finish;
      if (end > lastFinish) lastFinish = end;
      items.push({ op, start, finish, dias, diasRetoques, retoquesStart, retoquesFinish });
    }
    // Gantt rows and the report read top-to-bottom by start date.
    items.sort((a, b) => a.start - b.start);
    const cursor = lastFinish;
    const limpiezaStart  = new Date(cursor);
    const limpiezaFinish = this._addBusinessDays(limpiezaStart, this._DIAS_LIMPIEZA);
    return { items, limpiezaStart, limpiezaFinish };
  },

  // Flattens each OP's install segment (and, when it has retoques days
  // set, its separate retoques segment right after) into one ordered list
  // of bars — this is what actually gets drawn, one row per segment.
  _ganttBars(items) {
    const bars = [];
    for (const it of items) {
      const label = `${it.op.noOp ? it.op.noOp + ' — ' : ''}${it.op.name}`;
      bars.push({
        start: it.start, finish: it.finish, dias: it.dias,
        label, title: it.op.name, color: '#3b82f6',
      });
      if (it.diasRetoques > 0) {
        bars.push({
          start: it.retoquesStart, finish: it.retoquesFinish, dias: it.diasRetoques,
          label: `↳ Retoques — ${it.op.noOp || it.op.name}`,
          title: `${it.op.name} (Retoques)`,
          color: ESTATUS_INSTALACION_COLORS['RETOQUES'], italic: true,
        });
      }
    }
    return bars;
  },

  _ganttHtml(project, projOps) {
    const { items, limpiezaStart, limpiezaFinish } = this._projectedSchedule(projOps);
    if (!items.length) return '';

    const bars_spec = this._ganttBars(items);

    const rangeStart = items[0].start;
    const totalDays  = Math.max(1, daysBetween(rangeStart, limpiezaFinish));
    const pxPerDay   = 26;
    const labelW     = 260;
    const chartW     = totalDays * pxPerDay;
    const rowH       = 28;
    const rows       = bars_spec.length + 1; // + limpieza row
    const svgH       = rows * rowH + 30;
    const svgW       = labelW + chartW + 20;

    const xFor = d => labelW + daysBetween(rangeStart, d) * pxPerDay;
    const today = new Date(); today.setHours(0,0,0,0);

    let bars = '';
    // Weekend shading
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(rangeStart); d.setDate(d.getDate() + i);
      if (d.getDay() === 0 || d.getDay() === 6) {
        bars += `<rect x="${xFor(d)}" y="20" width="${pxPerDay}" height="${rows*rowH}" fill="#00000006"/>`;
      }
    }
    // Month/day axis ticks (every 7 days)
    for (let i = 0; i <= totalDays; i += 7) {
      const d = new Date(rangeStart); d.setDate(d.getDate() + i);
      bars += `<text x="${xFor(d)+2}" y="14" font-size="10" fill="#9b9490">${this._fmtShort(d)}</text>`;
      bars += `<line x1="${xFor(d)}" y1="18" x2="${xFor(d)}" y2="${svgH}" stroke="#ece8e2" stroke-width="1"/>`;
    }
    // Today marker
    if (today >= rangeStart && today <= limpiezaFinish) {
      bars += `<line x1="${xFor(today)}" y1="18" x2="${xFor(today)}" y2="${svgH}" stroke="#c41c1c" stroke-width="1.5" stroke-dasharray="3,2"/>`;
    }

    bars_spec.forEach((b, i) => {
      const y  = 26 + i * rowH;
      const x1 = xFor(b.start), x2 = xFor(b.finish);
      const w  = Math.max(4, x2 - x1);
      const lbl = b.label.length > 42 ? b.label.slice(0,41)+'…' : b.label;
      bars += `
        <text x="4" y="${y + rowH/2 + 4}" font-size="11" fill="#3a352f"${b.italic ? ' font-style="italic"' : ''}>${esc(lbl)}</text>
        <rect x="${x1}" y="${y+4}" width="${w}" height="${rowH-10}" rx="3" fill="${b.color}" opacity="0.85">
          <title>${esc(b.title)}: ${this._fmtShort(b.start)} → ${this._fmtShort(b.finish)} (${b.dias}d)</title>
        </rect>
        <text x="${x2 + 6}" y="${y + rowH/2 + 4}" font-size="9.5" fill="#9b9490">${b.dias}d</text>
      `;
    });
    // Limpieza row
    {
      const i = bars_spec.length;
      const y = 26 + i * rowH;
      const x1 = xFor(limpiezaStart), x2 = xFor(limpiezaFinish);
      const w  = Math.max(4, x2 - x1);
      bars += `
        <text x="4" y="${y + rowH/2 + 4}" font-size="11" fill="#3a352f" font-style="italic">Limpieza general</text>
        <rect x="${x1}" y="${y+4}" width="${w}" height="${rowH-10}" rx="3" fill="#9b9490" opacity="0.7"/>
      `;
    }

    const svg = `<svg width="${svgW}" height="${svgH}" style="display:block;overflow:visible">${bars}</svg>`;

    return `
      <div class="inst-gantt">
        <div class="inst-gantt-hdr">
          <span>Inicio proyectado: <strong>${this._fmtShort(rangeStart)}</strong></span>
          <span>Fin proyectado (con limpieza): <strong>${this._fmtShort(limpiezaFinish)}</strong></span>
          <span class="cron-faint">Días de instalación y retoques editables abajo, en cada tarjeta.</span>
        </div>
        <div style="overflow-x:auto;padding-bottom:6px">${svg}</div>
      </div>
    `;
  },

  // ── 🖨 Informe semanal por proyecto ───────────────────────────
  // Resumen imprimible para mandar al cliente/jefatura: estado de cada OP,
  // el cronograma proyectado (misma barra que se ve en pantalla) y qué se
  // trabajó realmente en los últimos 7 días según la bitácora.
  _printProyecto(projName, projOps) {
    const today   = new Date();
    const months  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const todayFmt = `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`;

    const { items } = this._projectedSchedule(projOps);
    const byOpId = Object.fromEntries(items.map(it => [it.op.id, it]));

    const sorted = [...projOps].sort((a, b) => {
      const ia = byOpId[a.id], ib = byOpId[b.id];
      if (!ia && !ib) return 0;
      if (!ia) return 1;
      if (!ib) return -1;
      return ia.start - ib.start;
    });

    const opRows = sorted.map((op, idx) => {
      const it          = byOpId[op.id];
      const row         = this._installRow(op.id);
      const installers  = this._instaladoresFor(op.id).join(', ') || '—';
      const estatus     = op.estatusInstalacion || 'SIN COMENZAR';
      const fechaFinReal = row?.fecha_fin ? this._fmtShort(new Date(row.fecha_fin + 'T12:00:00')) : '—';
      const fechaFinEst  = it ? this._fmtShort(it.retoquesFinish || it.finish) : '—';
      const diasTxt      = it ? `${it.dias}d${it.diasRetoques > 0 ? ` + ${it.diasRetoques}d retoques` : ''}` : '—';
      return `<tr>
        <td class="td-num">${idx + 1}</td>
        <td class="td-op">${esc(op.noOp || '—')}</td>
        <td class="td-desc">${esc(op.name)}</td>
        <td class="td-est">${esc(estatus)}</td>
        <td class="td-pct">${row?.porcentaje != null ? row.porcentaje + '%' : '—'}</td>
        <td class="td-inst">${esc(installers)}</td>
        <td class="td-dias">${esc(diasTxt)}</td>
        <td class="td-date">${fechaFinEst}</td>
        <td class="td-date">${fechaFinReal}</td>
      </tr>`;
    }).join('');

    // Actividad real de la última semana, tomada de la bitácora — esto es
    // lo que responde "qué OPs se trabajaron" en el informe.
    const opIds  = new Set(projOps.map(o => o.id));
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const recent = (this._dbData?.bitacoraInstalacion || [])
      .filter(e => opIds.has(e.op_id) && new Date(e.created_at) >= cutoff)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const opLabelById = Object.fromEntries(projOps.map(o => [o.id, `${o.noOp ? o.noOp + ' — ' : ''}${o.name}`]));

    const activityRows = recent.map(e => `<tr>
      <td class="td-date">${new Date(e.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</td>
      <td class="td-op">${esc(opLabelById[e.op_id] || '')}</td>
      <td class="td-tipo">${this._tipoIcon(e.tipo)}</td>
      <td class="td-texto">${esc(e.texto || '')}</td>
    </tr>`).join('');

    const ganttHtml = this._ganttHtml(projName, projOps);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe de Instalación — ${esc(projName)}</title>
<style>
  @page { size: letter portrait; margin: 0.65in 0.75in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #111; background: #fff; }
  .proj-hdr {
    display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2.5pt solid #8B1A1A; padding-bottom: 8pt; margin-bottom: 12pt;
  }
  .proj-title { font-size: 15pt; font-weight: 700; color: #8B1A1A; letter-spacing: -0.02em; }
  .proj-date  { font-size: 9.5pt; color: #666; }
  h2.section {
    font-size: 11pt; font-weight: 700; color: #8B1A1A; letter-spacing: -0.01em;
    margin: 18pt 0 6pt; border-bottom: 1pt solid #e8e0db; padding-bottom: 3pt;
  }
  table { width: 100%; border-collapse: collapse; orphans: 3; widows: 3; }
  thead tr { background: #f4eeea; }
  th {
    font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    color: #555; padding: 5pt 6pt; text-align: left; border-bottom: 1pt solid #c8b8b0; white-space: nowrap;
  }
  td { padding: 5pt 6pt; border-bottom: 0.5pt solid #e8e0db; font-size: 9.5pt; vertical-align: top; line-height: 1.3; }
  tr:last-child td { border-bottom: none; }
  .td-num  { width: 16pt; text-align: center; color: #888; font-size: 9pt; }
  .td-op   { width: 58pt; font-weight: 700; color: #8B1A1A; white-space: nowrap; }
  .td-desc { color: #111; }
  .td-est  { width: 80pt; }
  .td-pct  { width: 40pt; text-align: center; white-space: nowrap; }
  .td-inst { width: 110pt; }
  .td-dias { width: 90pt; white-space: nowrap; }
  .td-date { width: 60pt; white-space: nowrap; }
  .td-tipo { width: 18pt; text-align: center; }
  .cron-faint { color: #aaa; font-style: italic; }
  .inst-gantt-hdr { display: flex; gap: 16px; font-size: 9pt; color: #666; margin-bottom: 6pt; flex-wrap: wrap; }
  .inst-gantt-hdr strong { color: #111; }
  .tbl-footer { margin-top: 10pt; font-size: 8pt; color: #aaa; text-align: right; }
</style>
</head>
<body>
<div class="proj-hdr">
  <div class="proj-title">Informe de Instalación — ${esc(projName)}</div>
  <div class="proj-date">${todayFmt}</div>
</div>

<h2 class="section">Estado de las OPs</h2>
<table>
  <thead><tr>
    <th>#</th><th>No. OP</th><th>Descripción</th><th>Estatus</th><th>Avance</th><th>Instalador(es)</th>
    <th>Días (instal. + retoques)</th><th>Fin estimado</th><th>Fin real</th>
  </tr></thead>
  <tbody>${opRows}</tbody>
</table>

<h2 class="section">Cronograma proyectado</h2>
${ganttHtml || '<p class="cron-faint">Sin datos suficientes para proyectar el cronograma.</p>'}

<h2 class="section">Actividad de los últimos 7 días</h2>
<table>
  <thead><tr><th>Fecha</th><th>OP</th><th></th><th>Nota</th></tr></thead>
  <tbody>${activityRows || '<tr><td colspan="4" class="cron-faint">Sin actividad registrada esta semana.</td></tr>'}</tbody>
</table>

<div class="tbl-footer">${projOps.length} OP${projOps.length !== 1 ? 's' : ''} en instalación · Wood Concept Instalación</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permite ventanas emergentes para imprimir.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  },

  _opCardHtml(op) {
    const installers = this._instaladoresFor(op.id);
    const row        = this._installRow(op.id);
    const estatus     = op.estatusInstalacion || 'SIN COMENZAR';
    const estColor    = ESTATUS_INSTALACION_COLORS[estatus] || '#b5bcc2';
    const expanded    = this._expanded.has(op.id);
    const completa    = row?.llego_completa;

    const searchText = `${op.project || ''} ${op.noOp || ''} ${op.name || ''}`.toLowerCase();

    return `
      <div class="inst-op-card" data-search="${esc(searchText)}">
        <div class="inst-op-hdr" data-op="${esc(op.id)}">
          <button class="inst-op-toggle" data-toggle="${esc(op.id)}">${expanded ? '▼' : '▶'}</button>
          ${op.noOp ? `<span class="cron-op-num">${esc(op.noOp)}</span>` : ''}
          <span class="cron-name">${esc(op.name)}</span>
          <span class="inst-est-badge" style="background:${estColor}22;color:${estColor};border-color:${estColor}66">${esc(estatus)}</span>
          ${row?.porcentaje != null ? `
            <span class="inst-pct" title="Avance de la OP">
              <span class="inst-pct-bar"><span style="width:${row.porcentaje}%"></span></span>${row.porcentaje}%
            </span>` : ''}
          ${installers.length ? `<span class="inst-installer-tag">👷 ${esc(installers.join(', '))}</span>` : '<span class="cron-faint">Sin instalador</span>'}
          ${completa === false ? '<span class="badge-reproceso-sm">Incompleta</span>' : ''}
        </div>
        ${expanded ? this._opDetailHtml(op, installers, row, estatus) : ''}
      </div>
    `;
  },

  _opDetailHtml(op, installers, row, estatus) {
    const bitacora    = this._bitacoraFor(op.id);
    const tipo         = this._draftTipo[op.id]  || 'nota';
    const texto        = this._draftTexto[op.id] || '';
    const installerOpts = this._instaladores.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    const estatusOpts   = ESTATUS_INSTALACION_STAGES.map(s =>
      `<option value="${esc(s.id)}" ${s.id === estatus ? 'selected' : ''}>${esc(s.id)}</option>`).join('');

    return `
      <div class="inst-op-detail">

        <div class="inst-detail-row">
          <div class="inst-detail-col">
            <label class="field-label">Instaladores</label>
            <div class="inst-chip-row">
              ${installers.map(name => `
                <span class="inst-chip">${esc(name)}
                  <button class="inst-chip-x" data-op="${esc(op.id)}" data-person="${esc(name)}">✕</button>
                </span>
              `).join('') || '<span class="cron-faint">Ninguno asignado</span>'}
            </div>
            <div class="inst-add-row">
              <select class="field-input inst-add-installer" data-op="${esc(op.id)}">
                <option value="">— Agregar instalador —</option>
                ${installerOpts}
              </select>
            </div>
          </div>

          <div class="inst-detail-col">
            <label class="field-label">Estatus instalación</label>
            <select class="field-input inst-estatus-sel" data-op="${esc(op.id)}">${estatusOpts}</select>

            <label class="field-label" style="margin-top:10px">Avance (%)</label>
            <select class="field-input inst-pct-sel" data-op="${esc(op.id)}" style="max-width:110px">
              <option value="" ${row?.porcentaje == null ? 'selected' : ''}>—</option>
              ${Array.from({ length: 21 }, (_, i) => i * 5).map(p =>
                `<option value="${p}" ${row?.porcentaje === p ? 'selected' : ''}>${p}%</option>`).join('')}
            </select>

            <label class="field-label" style="margin-top:10px">¿Llegó completa de fábrica?</label>
            <div class="inst-completa-row">
              <button class="btn-sm ${row?.llego_completa === true  ? 'btn-primary' : 'btn-secondary'}" data-op="${esc(op.id)}" data-completa="true">Sí</button>
              <button class="btn-sm ${row?.llego_completa === false ? 'btn-primary' : 'btn-secondary'}" data-op="${esc(op.id)}" data-completa="false">No</button>
            </div>
            ${row?.llego_completa === false ? `
              <input type="text" class="field-input inst-faltante-inp" data-op="${esc(op.id)}"
                placeholder="¿Qué faltó?" value="${esc(row?.faltante || '')}">
            ` : ''}
          </div>

          <div class="inst-detail-col">
            <label class="field-label">Fechas</label>
            <div class="inst-dates">
              ${[
                ['envio',  'Envío a sitio',      this._isoDate(op.envioInstalacion)],
                ['inicio', 'Inicio instalación', this._isoDate(op.inicioInstalacion)],
                ['fin',    'Fin instalación',    row?.fecha_fin || ''],
              ].map(([kind, lbl, val]) => `
                <span class="inst-date-row">
                  <span class="inst-date-lbl">${lbl}:</span>
                  <input type="date" class="field-input inst-fecha-inp" data-op="${esc(op.id)}" data-kind="${kind}" value="${val}">
                  <button class="btn-secondary btn-sm inst-btn-fecha-hoy" data-op="${esc(op.id)}" data-kind="${kind}">Hoy</button>
                </span>
              `).join('')}
            </div>
            <label class="field-label">Días estimados — Instalación</label>
            <input type="number" min="1" class="field-input inst-dias-estimados-inp" data-op="${esc(op.id)}"
              value="${row?.dias_estimados ?? this._DEFAULT_DIAS_ESTIMADOS}" style="max-width:80px">
            <label class="field-label" style="margin-top:8px">Días estimados — Retoques (0 = sin etapa de retoques)</label>
            <input type="number" min="0" class="field-input inst-dias-retoques-inp" data-op="${esc(op.id)}"
              value="${row?.dias_retoques ?? this._DEFAULT_DIAS_RETOQUES}" style="max-width:80px">
            ${estatus !== 'COMPLETADO' ? `<button class="btn-primary btn-sm inst-btn-completar" data-op="${esc(op.id)}" style="margin-top:8px">✔ Marcar instalación completa</button>` : ''}
          </div>
        </div>

        <div class="inst-bitacora">
          <div class="inst-bitacora-hdr">Bitácora</div>
          <div class="inst-bitacora-compose">
            <select class="field-input inst-tipo-sel" data-op="${esc(op.id)}">${this._tipoOptions(tipo)}</select>
            <textarea class="field-input inst-texto-inp" data-op="${esc(op.id)}" placeholder="Comentario...">${esc(texto)}</textarea>
            <div class="inst-foto-row">
              ${this._fotoUploading[op.id] ? '<span class="btn-secondary btn-sm inst-foto-label">⏳ Subiendo...</span>'
                : this._draftFoto[op.id] ? '<span class="btn-secondary btn-sm inst-foto-label">✅ Foto lista</span>'
                : `
                <label class="btn-secondary btn-sm inst-foto-label" for="foto-cam-${esc(op.id)}">📷 Tomar foto</label>
                <label class="btn-secondary btn-sm inst-foto-label" for="foto-gal-${esc(op.id)}">🖼 Adjuntar foto</label>
              `}
              <!-- capture="environment" forces the camera on phones; the second input has no capture so it opens the gallery/files -->
              <input type="file" accept="image/*" capture="environment" id="foto-cam-${esc(op.id)}"
                class="inst-foto-inp" data-op="${esc(op.id)}" style="display:none">
              <input type="file" accept="image/*" id="foto-gal-${esc(op.id)}"
                class="inst-foto-inp" data-op="${esc(op.id)}" style="display:none">
              ${this._draftFoto[op.id] ? `
                <img src="${esc(this._draftFoto[op.id])}" class="inst-foto-thumb">
                <button class="inst-foto-remove" data-op="${esc(op.id)}">✕</button>
              ` : ''}
            </div>
            <div class="inst-compose-actions">
              ${tipo === 'reproceso' ? `<button class="btn-secondary btn-sm inst-btn-reproceso-form" data-op="${esc(op.id)}">📋 Llenar formulario de reproceso</button>` : ''}
              <button class="btn-primary btn-sm inst-btn-guardar" data-op="${esc(op.id)}">Guardar</button>
            </div>
          </div>
          <ul class="inst-bitacora-list">
            ${bitacora.map(e => this._editingEntry === e.id ? `
              <li class="inst-bitacora-item inst-bitacora-editing">
                <select class="field-input inst-edit-tipo">${this._tipoOptions(this._editDraft.tipo, true)}</select>
                <textarea class="field-input inst-edit-texto">${esc(this._editDraft.texto)}</textarea>
                <span class="inst-bitacora-edit-actions">
                  <button class="btn-primary btn-sm inst-edit-save" data-id="${esc(e.id)}">Guardar</button>
                  <button class="btn-secondary btn-sm inst-edit-cancel">Cancelar</button>
                </span>
              </li>
            ` : `
              <li class="inst-bitacora-item ${e.es_reproceso ? 'inst-bitacora-reproceso' : ''}">
                <span class="inst-bitacora-tipo">${this._tipoIcon(e.tipo)}</span>
                <span class="inst-bitacora-texto">${esc(e.texto || '')}</span>
                ${e.foto_url ? `
                  <span class="inst-bitacora-foto-wrap">
                    <a href="${esc(e.foto_url)}" target="_blank" rel="noopener"><img src="${esc(e.foto_url)}" class="inst-foto-thumb"></a>
                    <button class="inst-bitacora-foto-del" data-id="${esc(e.id)}" data-url="${esc(e.foto_url)}" title="Borrar foto">✕</button>
                  </span>
                ` : ''}
                <span class="inst-bitacora-fecha">${new Date(e.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                <button class="inst-bitacora-act inst-entry-edit" data-id="${esc(e.id)}" title="Editar">✏️</button>
                <button class="inst-bitacora-act inst-entry-del" data-id="${esc(e.id)}" title="Borrar entrada">🗑</button>
              </li>
            `).join('') || '<li class="cron-faint">Sin entradas todavía.</li>'}
          </ul>
        </div>
      </div>
    `;
  },

  _tipoIcon(tipo) {
    return { nota: '📝', inicio: '▶', pausa: '⏸', reanudado: '▶', cambio_sitio: '🔁', reproceso: '⚠', fin: '✔' }[tipo] || '📝';
  },

  _tipoOptions(selected, includeFin = false) {
    const tipos = [
      ['nota', '📝 Nota'], ['inicio', '▶ Inicio'], ['pausa', '⏸ Pausa'], ['reanudado', '▶ Reanudado'],
      ['cambio_sitio', '🔁 Cambio en sitio'], ['reproceso', '⚠ Reproceso'],
    ];
    if (includeFin) tipos.push(['fin', '✔ Fin']);
    return tipos.map(([v, l]) => `<option value="${v}" ${selected === v ? 'selected' : ''}>${l}</option>`).join('');
  },

  // Sets (or clears, when iso is '') one of the OP's install dates.
  // Envío / inicio live in ClickUp date fields; fin lives in Supabase
  // (instalacion_ops.fecha_fin) because ClickUp has no field for it.
  async _setFecha(opId, kind, iso) {
    const op = this._ops.find(o => o.id === opId);
    if (!op) return;
    if (kind === 'fin') {
      const saved = await DB.upsertInstalacionOp({ op_id: opId, fecha_fin: iso || null });
      this._upsertLocalInstalacionOp(saved);
    } else {
      const key = kind === 'envio' ? 'envioInstalacion' : 'inicioInstalacion';
      const fieldId = this._fieldIds[key];
      if (!fieldId) throw new Error('No se encontró el campo de fecha en ClickUp');
      if (iso) {
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(y, m - 1, d, 12);   // local noon — avoids shifting a day across time zones
        await PlantaAPI.setField(opId, fieldId, date.getTime());
        op[key] = date;
      } else {
        await PlantaAPI.removeField(opId, fieldId);
        op[key] = null;
      }
      PlantaAPI.clearCache();
    }
    this._draw();
  },

  _bindInstalacion(wrap) {
    wrap.querySelectorAll('.inst-fecha-inp').forEach(inp => {
      inp.addEventListener('change', async () => {
        inp.disabled = true;
        try { await this._setFecha(inp.dataset.op, inp.dataset.kind, inp.value); }
        catch (e) { alert('Error: ' + e.message); inp.disabled = false; }
      });
    });
    wrap.querySelectorAll('.inst-btn-fecha-hoy').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = '...';
        try { await this._setFecha(btn.dataset.op, btn.dataset.kind, todayIso()); }
        catch (e) { alert('Error: ' + e.message); btn.disabled = false; btn.textContent = 'Hoy'; }
      });
    });

    wrap.querySelectorAll('.inst-pct-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        const opId = sel.dataset.op;
        const pct  = sel.value === '' ? null : parseInt(sel.value, 10);
        try {
          const saved = await DB.upsertInstalacionOp({ op_id: opId, porcentaje: pct });
          this._upsertLocalInstalacionOp(saved);
          this._draw();
        } catch (e) { alert('Error al guardar el porcentaje: ' + e.message); }
      });
    });

    // ── Editar / borrar entradas de la bitácora ──
    wrap.querySelectorAll('.inst-entry-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = this._dbData.bitacoraInstalacion.find(e => e.id === btn.dataset.id);
        if (!entry) return;
        this._editingEntry = entry.id;
        this._editDraft = { tipo: entry.tipo || 'nota', texto: entry.texto || '' };
        this._draw();
      });
    });
    wrap.querySelectorAll('.inst-edit-tipo').forEach(sel => {
      sel.addEventListener('change', () => { this._editDraft.tipo = sel.value; });
    });
    wrap.querySelectorAll('.inst-edit-texto').forEach(ta => {
      ta.addEventListener('input', () => { this._editDraft.texto = ta.value; });
    });
    wrap.querySelectorAll('.inst-edit-cancel').forEach(btn => {
      btn.addEventListener('click', () => { this._editingEntry = null; this._draw(); });
    });
    wrap.querySelectorAll('.inst-edit-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          const saved = await DB.updateBitacoraEntry(id, {
            tipo:  this._editDraft.tipo,
            texto: this._editDraft.texto.trim() || null,
          });
          const arr = this._dbData.bitacoraInstalacion;
          const idx = arr.findIndex(e => e.id === id);
          if (idx >= 0) arr[idx] = saved;
          this._editingEntry = null;
          this._draw();
        } catch (e) {
          alert('Error: ' + e.message);
          btn.disabled = false;
        }
      });
    });
    wrap.querySelectorAll('.inst-entry-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Borrar esta entrada de la bitácora?')) return;
        const id = btn.dataset.id;
        const entry = this._dbData.bitacoraInstalacion.find(e => e.id === id);
        btn.disabled = true;
        try {
          await DB.deleteBitacoraEntry(id);
          if (entry?.foto_url) await DB.deleteFotoByUrl(entry.foto_url);
          this._dbData.bitacoraInstalacion = this._dbData.bitacoraInstalacion.filter(e => e.id !== id);
          this._draw();
        } catch (e) {
          alert('Error: ' + e.message);
          btn.disabled = false;
        }
      });
    });

    wrap.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggle;
        if (this._expanded.has(id)) this._expanded.delete(id); else this._expanded.add(id);
        this._draw();
      });
    });

    wrap.querySelectorAll('.inst-gantt-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const proj = btn.dataset.proj;
        if (this._ganttOpen.has(proj)) this._ganttOpen.delete(proj); else this._ganttOpen.add(proj);
        this._draw();
      });
    });

    wrap.querySelectorAll('.inst-print-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const proj = btn.dataset.proj;
        const projOps = this._ops.filter(o => (o.project || '(Sin proyecto)') === proj && o.status === 'en instalacion');
        this._printProyecto(proj, projOps);
      });
    });

    wrap.querySelectorAll('.inst-dias-estimados-inp').forEach(inp => {
      inp.addEventListener('change', async () => {
        const opId = inp.dataset.op;
        const dias = Math.max(1, parseInt(inp.value, 10) || this._DEFAULT_DIAS_ESTIMADOS);
        try {
          const saved = await DB.upsertInstalacionOp({ op_id: opId, dias_estimados: dias });
          this._upsertLocalInstalacionOp(saved);
          this._draw();
        } catch (e) { console.warn('[Instalacion] dias_estimados save:', e.message); }
      });
    });

    wrap.querySelectorAll('.inst-dias-retoques-inp').forEach(inp => {
      inp.addEventListener('change', async () => {
        const opId = inp.dataset.op;
        const dias = Math.max(0, parseInt(inp.value, 10) || 0);
        try {
          const saved = await DB.upsertInstalacionOp({ op_id: opId, dias_retoques: dias });
          this._upsertLocalInstalacionOp(saved);
          this._draw();
        } catch (e) { console.warn('[Instalacion] dias_retoques save:', e.message); }
      });
    });

    wrap.querySelectorAll('.inst-add-installer').forEach(sel => {
      sel.addEventListener('change', async () => {
        const opId = sel.dataset.op;
        const person = sel.value;
        if (!person) return;
        try {
          await DB.setAsignacion(opId, 'instalacion', person);
          this._dbData.asignaciones.push({ op_id: opId, etapa: 'instalacion', persona: person, fecha_asignacion: todayIso() });
          await this._mirrorInstalador(opId);
          this._draw();
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

    wrap.querySelectorAll('.inst-chip-x').forEach(btn => {
      btn.addEventListener('click', async () => {
        const opId = btn.dataset.op, person = btn.dataset.person;
        this._dbData.asignaciones = this._dbData.asignaciones.filter(
          a => !(a.op_id === opId && a.etapa === 'instalacion' && a.persona === person));
        DB.removeAsignacion(opId, person, 'instalacion').catch(e => console.warn('[Instalacion] remove:', e.message));
        await this._mirrorInstalador(opId);
        this._draw();
      });
    });

    wrap.querySelectorAll('.inst-estatus-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        const opId = sel.dataset.op;
        const value = sel.value;
        const op = this._ops.find(o => o.id === opId);
        const optId = this._fieldIds.estatusInstalacionOpts?.[normStr(value)];
        if (!optId || !this._fieldIds.estatusInstalacion) return;
        try {
          await PlantaAPI.setField(opId, this._fieldIds.estatusInstalacion, optId);
          if (op) op.estatusInstalacion = value;
          PlantaAPI.clearCache();
          this._draw();
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

    wrap.querySelectorAll('[data-completa]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const opId = btn.dataset.op;
        const val  = btn.dataset.completa === 'true';
        try {
          const saved = await DB.upsertInstalacionOp({ op_id: opId, llego_completa: val });
          this._upsertLocalInstalacionOp(saved);
          this._draw();
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

    wrap.querySelectorAll('.inst-faltante-inp').forEach(inp => {
      inp.addEventListener('change', async () => {
        const opId = inp.dataset.op;
        try {
          const saved = await DB.upsertInstalacionOp({ op_id: opId, faltante: inp.value });
          this._upsertLocalInstalacionOp(saved);
        } catch (e) { console.warn('[Instalacion] faltante save:', e.message); }
      });
    });

    wrap.querySelectorAll('.inst-tipo-sel').forEach(sel => {
      sel.addEventListener('change', () => { this._draftTipo[sel.dataset.op] = sel.value; this._draw(); });
    });
    wrap.querySelectorAll('.inst-texto-inp').forEach(ta => {
      ta.addEventListener('input', () => { this._draftTexto[ta.dataset.op] = ta.value; });
    });

    wrap.querySelectorAll('.inst-btn-reproceso-form').forEach(btn => {
      btn.addEventListener('click', () => {
        const opId = btn.dataset.op;
        const op = this._ops.find(o => o.id === opId);
        const url = buildReprocesoFormUrl({
          cliente: op?.project || '',
          op:      op?.noOp || '',
          motivo:  this._draftTexto[opId] || '',
        });
        window.open(url, '_blank');
      });
    });

    wrap.querySelectorAll('.inst-btn-guardar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const opId  = btn.dataset.op;
        const tipo  = this._draftTipo[opId] || 'nota';
        const texto = (this._draftTexto[opId] || '').trim();
        const fotoUrl = this._draftFoto[opId] || null;
        if (!texto && !fotoUrl) return;
        btn.disabled = true;
        try {
          const saved = await DB.addBitacoraEntry({ op_id: opId, tipo, texto: texto || null, es_reproceso: tipo === 'reproceso', foto_url: fotoUrl });
          this._dbData.bitacoraInstalacion.unshift(saved);
          delete this._draftTexto[opId];
          delete this._draftFoto[opId];
          this._draftTipo[opId] = 'nota';
          this._draw();
        } catch (e) {
          alert('Error: ' + e.message);
          btn.disabled = false;
        }
      });
    });

    wrap.querySelectorAll('.inst-foto-inp').forEach(inp => {
      inp.addEventListener('change', async () => {
        const opId = inp.dataset.op;
        const file = inp.files?.[0];
        if (!file) return;
        this._fotoUploading[opId] = true;
        this._draw();
        try {
          const url = await DB.uploadFoto(opId, file);
          this._draftFoto[opId] = url;
        } catch (e) {
          alert('No se pudo subir la foto: ' + e.message);
        } finally {
          delete this._fotoUploading[opId];
          this._draw();
        }
      });
    });

    wrap.querySelectorAll('.inst-foto-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        delete this._draftFoto[btn.dataset.op];
        this._draw();
      });
    });

    // Deletes a photo already attached to a saved bitácora entry (keeps
    // the entry itself — just clears its foto_url — and best-effort
    // removes the underlying file from Storage).
    wrap.querySelectorAll('.inst-bitacora-foto-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Borrar esta foto?')) return;
        const id = btn.dataset.id, url = btn.dataset.url;
        btn.disabled = true;
        try {
          await DB.updateBitacoraFoto(id, null);
          await DB.deleteFotoByUrl(url);
          const entry = this._dbData.bitacoraInstalacion.find(e => e.id === id);
          if (entry) entry.foto_url = null;
          this._draw();
        } catch (e) {
          alert('Error: ' + e.message);
          btn.disabled = false;
        }
      });
    });

    wrap.querySelectorAll('.inst-btn-completar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const opId = btn.dataset.op;
        const op = this._ops.find(o => o.id === opId);
        btn.disabled = true; btn.textContent = '...';
        try {
          const optId = this._fieldIds.estatusInstalacionOpts?.[normStr('COMPLETADO')];
          if (optId && this._fieldIds.estatusInstalacion) {
            await PlantaAPI.setField(opId, this._fieldIds.estatusInstalacion, optId);
          }
          const saved = await DB.upsertInstalacionOp({ op_id: opId, fecha_fin: todayIso() });
          this._upsertLocalInstalacionOp(saved);
          const entry = await DB.addBitacoraEntry({ op_id: opId, tipo: 'fin', texto: 'Instalación completada' });
          this._dbData.bitacoraInstalacion.unshift(entry);
          if (op) op.estatusInstalacion = 'COMPLETADO';
          PlantaAPI.clearCache();
          this._draw();
        } catch (e) {
          alert('Error: ' + e.message);
          btn.disabled = false; btn.textContent = '✔ Marcar instalación completa';
        }
      });
    });
  },

  _upsertLocalInstalacionOp(row) {
    if (!row) return;
    const arr = this._dbData.instalacionOps;
    const idx = arr.findIndex(r => r.op_id === row.op_id);
    if (idx >= 0) arr[idx] = row; else arr.push(row);
  },

  // Mirrors the *first* assigned installer into ClickUp's single-select
  // INSTALADORES dropdown — best-effort, since ClickUp can only hold one
  // value there even when several installers are assigned in the app.
  async _mirrorInstalador(opId) {
    const names  = this._instaladoresFor(opId);
    const optId  = names.length === 1 ? this._fieldIds.instaladorOpts?.[normStr(names[0])] : null;
    if (!optId || !this._fieldIds.instaladores) return;
    try {
      await PlantaAPI.setField(opId, this._fieldIds.instaladores, optId);
      PlantaAPI.clearCache();
    } catch (e) { console.warn('[Instalacion] mirror instalador failed:', e.message); }
  },

  // ── 📊 Rendimiento de instaladores ───────────────────────────

  _renderRendimiento() {
    const asignaciones = (this._dbData?.asignaciones || []).filter(a => a.etapa === 'instalacion');
    const names = [...new Set(asignaciones.map(a => a.persona))].sort();
    if (!names.length) return '<div class="cron-empty">Todavía no hay instaladores asignados.</div>';

    const opsById = Object.fromEntries(this._ops.map(o => [o.id, o]));
    const rows = names.map(name => {
      const myOpIds = asignaciones.filter(a => a.persona === name).map(a => a.op_id);
      const total = myOpIds.length;
      const finishedRows = myOpIds
        .map(id => this._installRow(id))
        .filter(r => r && r.fecha_fin);
      const completed = finishedRows.length;
      const durations = finishedRows.map(r => {
        const op = opsById[r.op_id];
        const start = op?.inicioInstalacion;
        if (!start) return null;
        return daysBetween(start, new Date(r.fecha_fin + 'T12:00:00'));
      }).filter(d => d !== null && d >= 0);
      const avgDays = durations.length ? (durations.reduce((a,b)=>a+b,0) / durations.length) : null;
      const reprocesos = (this._dbData?.bitacoraInstalacion || [])
        .filter(e => e.es_reproceso && myOpIds.includes(e.op_id)).length;
      const incompletas = myOpIds.filter(id => this._installRow(id)?.llego_completa === false).length;
      return { name, total, completed, avgDays, reprocesos, incompletas };
    }).sort((a, b) => b.completed - a.completed);

    return `
      <table class="ranking-table">
        <thead><tr>
          <th>Instalador</th><th>OPs asignadas</th><th>Completadas</th>
          <th>Prom. días/OP</th><th>Reprocesos</th><th>Llegaron incompletas</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td data-label="Instalador">${esc(r.name)}</td>
              <td style="text-align:center" data-label="OPs asignadas">${r.total}</td>
              <td style="text-align:center" data-label="Completadas">${r.completed}</td>
              <td style="text-align:center" data-label="Prom. días/OP">${r.avgDays !== null ? r.avgDays.toFixed(1) : '—'}</td>
              <td style="text-align:center" data-label="Reprocesos">${r.reprocesos || 0}</td>
              <td style="text-align:center" data-label="Llegaron incompletas">${r.incompletas || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
};
