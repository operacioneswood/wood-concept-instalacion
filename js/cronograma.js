// ─────────────────────────────────────────────────────────────
// js/cronograma.js — Cronograma de Fábrica (solo lectura)
//
// Le da al coordinador de instalaciones visibilidad de lo que viene
// detrás — qué OPs siguen en fábrica y cuándo deberían salir — igual
// que el Cronograma de wood-concept-planta, pero sin edición (las
// fechas se manejan desde la app de planta).
// ─────────────────────────────────────────────────────────────

const Cronograma = {
  _ops: [],

  render({ ops }) {
    this._ops = ops || [];
    this._draw();
  },

  _draw() {
    const wrap = el('cronograma-container');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="tab-wrap">
        <div class="asign-header-row">
          <h2 class="tab-title">📊 Cronograma de Fábrica</h2>
          <p class="tab-sub">Solo lectura — las fechas se editan desde Wood Concept · Planta.</p>
        </div>
        <div class="cron-body">${this._renderProyecto()}</div>
      </div>
    `;
  },

  _renderProyecto() {
    const byProject = {};
    for (const op of this._ops) {
      const proj = op.project || 'Sin proyecto';
      if (!byProject[proj]) byProject[proj] = [];
      byProject[proj].push(op);
    }

    const sorted = Object.entries(byProject).sort(([, a], [, b]) => {
      const earliest = arr => arr.reduce((min, op) => (op.salidaFabrica && (!min || op.salidaFabrica < min)) ? op.salidaFabrica : min, null);
      const da = earliest(a), db = earliest(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });

    if (!sorted.length) return '<div class="cron-empty">Sin OPs activos en fábrica.</div>';

    return sorted.map(([project, ops]) => {
      const { overdue, urgent } = this._urgencyCounts(ops);
      const opsorted = [...ops].sort((a, b) => {
        if (!a.salidaFabrica && !b.salidaFabrica) return 0;
        if (!a.salidaFabrica) return 1;
        if (!b.salidaFabrica) return -1;
        return a.salidaFabrica - b.salidaFabrica;
      });

      const rows = opsorted.map(op => {
        const st = this._statusInfo(op.salidaFabrica);
        return `
          <tr>
            <td>${op.noOp ? `<span class="cron-op-num">${esc(op.noOp)}</span>` : '<span class="cron-faint">—</span>'}</td>
            <td class="cron-name">${esc(op.name)}</td>
            <td class="cron-etapa-cell">${this._opStatusBadge(op)}</td>
            <td class="cron-fecha-lbl cron-envio-lbl">${op.envioFabrica ? this._fmtShort(op.envioFabrica) : '<span class="cron-faint">—</span>'}</td>
            <td class="cron-fecha-lbl">${op.salidaFabrica ? this._fmtShort(op.salidaFabrica) : '<span class="cron-faint">—</span>'}</td>
            <td><span class="cron-badge ${st.cls}">${st.label}</span></td>
          </tr>
        `;
      }).join('');

      return `
        <div class="cron-block">
          <div class="cron-block-hdr">
            <span class="cron-hdr-name">${esc(project)}</span>
            <span class="cron-hdr-meta">
              <span class="cron-hdr-count">${ops.length} OP${ops.length !== 1 ? 's' : ''}</span>
              ${this._urgBadgesHtml(overdue, urgent)}
            </span>
          </div>
          <table class="cron-tbl">
            <thead><tr>
              <th>No. OP</th><th>Descripción</th><th>Etapa</th>
              <th>Envío Fáb.</th><th>Fecha límite</th><th>Estado</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');
  },

  _urgencyCounts(ops) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let overdue = 0, urgent = 0;
    for (const op of ops) {
      const d = op.salidaFabrica;
      if (!d) continue;
      const diff = Math.ceil((d - today) / 86400000);
      if (diff < 0) overdue++;
      else if (diff <= 7) urgent++;
    }
    return { overdue, urgent };
  },

  _urgBadgesHtml(overdue, urgent) {
    const parts = [];
    if (overdue > 0) parts.push(`<span class="cron-urg cron-red">${overdue} vencido${overdue > 1 ? 's' : ''}</span>`);
    if (urgent  > 0) parts.push(`<span class="cron-urg cron-amber">${urgent} urgente${urgent > 1 ? 's' : ''}</span>`);
    return parts.join('');
  },

  _opStatusBadge(op) {
    const key = normStr(op.status || '');
    const sd  = STATUS_DISPLAY[key];
    if (sd) return `<span class="status-badge ${sd.cls}">${esc(sd.label)}</span>`;
    return op.status ? `<span class="cron-etapa-lbl">${esc(op.statusRaw || op.status)}</span>` : '<span class="cron-faint">—</span>';
  },

  _statusInfo(d) {
    if (!d) return { label: 'Sin fecha', cls: 'cron-none' };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff  = Math.ceil((d - today) / 86400000);
    if (diff < 0)   return { label: `Vencido ${-diff}d`, cls: 'cron-red'   };
    if (diff === 0) return { label: 'Hoy',                cls: 'cron-red'   };
    if (diff <= 3)  return { label: `${diff}d`,           cls: 'cron-red'   };
    if (diff <= 7)  return { label: `${diff}d`,           cls: 'cron-amber' };
    return               { label: `${diff}d`,           cls: 'cron-green' };
  },

  _fmtShort(d) {
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  },
};
