// ─────────────────────────────────────────────────────────────
// js/acta.js — Acta de Entrega Final
//
// Se abre desde el botón "📄 Acta de entrega" de cada proyecto en
// "En Instalación": se escogen las OPs que se entregan, se llena el
// acta (proyecto, contratante, cotización = OPs, fecha), y ambas partes
// firman con el dedo en la pantalla. Se imprime / guarda como PDF y se
// archiva en Supabase (tabla actas_entrega) por proyecto.
// ─────────────────────────────────────────────────────────────

const ACTA_LOGO = 'data:image/png;base64,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';

const Acta = {
  _proj:      '',
  _ops:       [],
  _st:        null,
  _list:      [],
  _listErr:   null,
  _cotManual: false,
  _MESES:     ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
  _LS:        'wi_acta_contratista',

  // ── Entrada ──────────────────────────────────────────────────
  open(proj, ops) {
    this._proj = proj;
    this._ops  = ops || [];
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this._LS) || '{}'); } catch {}
    this._st = {
      id: null,
      proyecto: proj,
      contratante: '',
      opIds: new Set(this._ops.filter(o => o.status === 'completo').map(o => o.id)),
      cotizacion: '',
      fecha: todayIso(),
      obs: '',
      cNombre: saved.nombre || 'Jonathan González',
      cCargo:  saved.cargo  || 'Jefe de Instalaciones',
      kNombre: '', kCargo: '', kEmpresa: '',
      firmaC: null, firmaK: null,
      fotoUrl: null,
    };
    this._cotManual = false;
    this._st.cotizacion = this._cotAuto();
    this._ensureCss();
    this._build();
    this._loadList();
  },

  _cotAuto() {
    return this._ops.filter(o => this._st.opIds.has(o.id)).map(o => o.noOp || o.name).join(', ');
  },

  _parseDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  },

  // ── Documento (vista previa + impresión) ─────────────────────
  _docCss() {
    return `
.ac-sheet{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:10pt;line-height:1.4;background:#fff;padding:18px 14px}
.ac-sheet .ac-logo img{height:42px;display:block;margin:0 auto 8px}
.ac-sheet h1{font-size:13pt;text-align:center;margin:6px 0 12px;font-weight:700}
.ac-sheet .ac-f{margin:5px 0}
.ac-sheet .ac-f b{display:inline-block;min-width:112px}
.ac-sheet .ac-v{display:inline-block;min-width:280px;border-bottom:1px solid #000;padding:0 4px}
.ac-sheet p{margin:9px 0;text-align:justify}
.ac-sheet u{text-decoration:none;border-bottom:1px solid #000;padding:0 3px}
.ac-sheet ul{margin:6px 0 12px 22px;padding:0;text-align:justify}
.ac-sheet li{margin:3px 0}
.ac-sheet .ac-sign{display:flex;gap:40px;margin-top:20px;break-inside:avoid}
.ac-sheet .ac-sign>div{flex:1}
.ac-sheet .ac-sigimg{height:54px;display:flex;align-items:flex-end}
.ac-sheet .ac-sigimg img{max-height:52px;max-width:100%}
.ac-sheet .ac-sigline{border-top:1px solid #000;margin:2px 0 6px}
.ac-sheet .ac-row{margin:3px 0}
.ac-sheet .ac-obs{margin-top:18px;break-inside:avoid}
.ac-sheet .ac-obsbox{min-height:34px;white-space:pre-wrap;border-bottom:1px solid #000;padding:2px 0}
`;
  },

  _docHtml() {
    const s = this._st;
    const d = this._parseDate(s.fecha);
    const dia = d ? d.getDate() : '', mes = d ? this._MESES[d.getMonth()] : '', anio = d ? d.getFullYear() : '';
    const v = (x, n = 18) => (x && String(x).trim()) ? esc(String(x).trim()) : '&nbsp;'.repeat(n);
    const sig = img => `<div class="ac-sigimg">${img ? `<img src="${img}" alt="Firma">` : ''}</div>`;
    return `
<div class="ac-sheet">
  <div class="ac-logo"><img src="${ACTA_LOGO}" alt="WoodConcept, S.A."></div>
  <h1>ACTA DE ENTREGA FINAL</h1>
  <div class="ac-f"><b>PROYECTO:</b> <span class="ac-v">${v(s.proyecto, 30)}</span></div>
  <div class="ac-f"><b>CONTRATANTE:</b> <span class="ac-v">${v(s.contratante, 30)}</span></div>
  <div class="ac-f"><b>COTIZACIÓN:</b> <span class="ac-v">${v(s.cotizacion, 30)}</span></div>
  <p>El presente documento constituye el convenio denominado ACTA DE ENTREGA FINAL POR MUTUO ACUERDO, correspondiente al proyecto mencionado, entregado a los <u>${v(dia, 4)}</u> días del mes de <u>${v(mes, 10)}</u> del año <u>${v(anio, 5)}</u>. Se da ENTREGA al proyecto (<u>${v(s.proyecto, 20)}</u>), labores contratadas según cotización aprobada (<u>${v(s.cotizacion, 16)}</u>).</p>
  <p>Ambas partes establecen:</p>
  <ul>
    <li>Los ítems listados en la cotización aprobada fueron revisados y aprobados en temas de calidad y diseño por ambas partes.</li>
    <li>Cualquier diferencia entre el producto/diseño final entregado en esta acta y el considerado en la cotización inicial u otro medio de comunicación cruzada durante el proceso de desarrollo, se entiende como desistida o no deseada por el cliente. Así, se acepta que el producto está terminado totalmente, entregado y recibido a la satisfacción del cliente.</li>
    <li>Daños ocasionados por personal ajeno a nuestra compañía no están incluidos en la garantía.</li>
  </ul>
  <p>En constancia se firma la presente acta, TERMINADA la obra a la ejecución del proyecto de acuerdo con la cotización aprobada.</p>
  <div class="ac-sign">
    <div>
      <b>CONTRATISTA:</b>
      ${sig(s.firmaC)}
      <div class="ac-sigline"></div>
      <div class="ac-row"><b>Nombre:</b> ${v(s.cNombre, 12)}</div>
      <div class="ac-row"><b>Cargo:</b> ${v(s.cCargo, 12)}</div>
      <div class="ac-row"><b>WOODCONCEPT S.A.</b></div>
    </div>
    <div>
      <b>CONTRATANTE:</b>
      ${sig(s.firmaK)}
      <div class="ac-sigline"></div>
      <div class="ac-row"><b>Nombre:</b> ${v(s.kNombre, 12)}</div>
      <div class="ac-row"><b>Cargo:</b> ${v(s.kCargo, 12)}</div>
      <div class="ac-row"><b>Empresa:</b> ${v(s.kEmpresa, 12)}</div>
    </div>
  </div>
  <div class="ac-obs"><b>OBSERVACIONES:</b><div class="ac-obsbox">${esc(s.obs || '')}</div></div>
</div>`;
  },

  _print() {
    const s = this._st;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Acta de Entrega Final — ${esc(s.proyecto)}</title>
<style>@page{size:letter portrait;margin:0.7in 0.8in} body{margin:0} ${this._docCss()} .ac-sheet{padding:0}</style></head>
<body>${this._docHtml()}</body></html>`;
    const win = window.open('', '_blank', 'width=900,height=800');
    if (!win) { alert('Permite ventanas emergentes para imprimir.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  },

  // ── Interfaz ─────────────────────────────────────────────────
  _ensureCss() {
    if (document.getElementById('acta-css')) return;
    const st = document.createElement('style');
    st.id = 'acta-css';
    st.textContent = `
.acta-ov{position:fixed;inset:0;z-index:9000;background:rgba(20,16,12,.55);overflow:auto;-webkit-overflow-scrolling:touch}
.acta-card{background:#faf8f5;width:100%;max-width:1100px;margin:0 auto;min-height:100%}
.acta-hdr{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#1a1714;color:#fff;font-weight:600}
.acta-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;padding:0 6px}
.acta-body{padding:16px}
.acta-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:800px){.acta-grid{grid-template-columns:1fr}}
.acta-body input,.acta-body textarea{font-size:16px;width:100%;box-sizing:border-box}
.acta-body input[type=checkbox]{width:auto}
.acta-body label.field-label{display:block;margin:10px 0 4px}
.acta-ops{border:1px solid #ddd;border-radius:8px;background:#fff;max-height:230px;overflow:auto;padding:2px 10px}
.acta-ops label{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f0ece6;cursor:pointer;font-size:14px}
.acta-ops label:last-child{border-bottom:0}
.acta-grp{border:1px solid #e3ddd4;border-radius:10px;padding:12px;margin-bottom:12px;background:#fff}
.acta-grp-t{font-weight:700;margin-bottom:2px}
.acta-sigrow{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
.acta-sigrow img{height:34px;border:1px solid #ddd;border-radius:4px;background:#fff}
.acta-link{background:none;border:0;color:#8B1A1A;text-decoration:underline;cursor:pointer;font-size:13px;padding:0}
.acta-actions{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px}
.acta-msg{font-size:13px;min-height:18px;margin-bottom:6px}
.acta-msg.err{color:#b91c1c}.acta-msg.ok{color:#15803d}
.acta-list-i{display:flex;gap:8px;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;padding:8px 0;font-size:13px;flex-wrap:wrap}
.acta-prev-t{font-weight:700;margin:18px 0 8px}
#acta-prev{overflow:auto;background:#e9e4dc;padding:12px;border-radius:8px}
#acta-prev .ac-sheet{min-width:640px;max-width:780px;margin:0 auto;box-shadow:0 1px 6px rgba(0,0,0,.2)}
.acta-sig-ov{position:fixed;inset:0;z-index:10000;background:#fff;display:flex;flex-direction:column}
.acta-sig-top{padding:12px 16px;border-bottom:1px solid #ddd;display:flex;flex-direction:column;gap:2px}
.acta-sig-top span{font-size:13px;color:#666}
.acta-sig-box{position:relative;flex:1;margin:12px;border:2px dashed #b8afa3;border-radius:10px;background:#fcfbf9;overflow:hidden}
.acta-sig-box canvas{position:absolute;inset:0;touch-action:none;cursor:crosshair}
.acta-sig-guide{position:absolute;left:6%;right:6%;bottom:22%;border-top:1px solid #999;pointer-events:none}
.acta-sig-x{position:absolute;left:3%;bottom:22%;transform:translateY(55%);color:#888;font-size:18px;pointer-events:none}
.acta-sig-btns{display:flex;gap:10px;padding:10px 12px 14px;justify-content:flex-end}
.acta-sig-btns button{min-height:46px;min-width:110px;font-size:16px}
` + this._docCss();
    document.head.appendChild(st);
  },

  _build() {
    this.close();
    const s = this._st;
    const ov = document.createElement('div');
    ov.className = 'acta-ov';
    ov.id = 'acta-overlay';
    ov.innerHTML = `
<div class="acta-card">
  <div class="acta-hdr"><span>📄 Acta de entrega final — ${esc(this._proj)}</span><button class="acta-x" data-a="close" title="Cerrar">✕</button></div>
  <div class="acta-body">
    <div class="acta-grid">
      <div>
        <label class="field-label">Proyecto</label>
        <input class="field-input" data-f="proyecto" value="${esc(s.proyecto)}">
        <label class="field-label">Contratante</label>
        <input class="field-input" data-f="contratante" placeholder="Nombre del contratante" value="${esc(s.contratante)}">
        <label class="field-label">OPs que se entregan</label>
        <div class="acta-ops">
          ${this._ops.map(o => `
            <label><input type="checkbox" data-op="${esc(o.id)}" ${s.opIds.has(o.id) ? 'checked' : ''}>
              <span><b>${esc(o.noOp || '—')}</b> · ${esc(o.name)}${o.status === 'completo' ? ' <span style="color:#15803d">✔ completa</span>' : ''}</span></label>
          `).join('') || '<div class="cron-faint" style="padding:8px 0">No hay OPs en este proyecto.</div>'}
        </div>
        <label class="field-label">Cotización <span style="font-weight:400;color:#888">(se llena con las OPs; puedes editarla)</span></label>
        <input class="field-input" data-f="cotizacion" value="${esc(s.cotizacion)}">
        <label class="field-label">Fecha de entrega</label>
        <input class="field-input" type="date" data-f="fecha" value="${esc(s.fecha)}">
        <label class="field-label">Observaciones</label>
        <textarea class="field-input" rows="3" data-f="obs">${esc(s.obs)}</textarea>
      </div>
      <div>
        <div class="acta-grp">
          <div class="acta-grp-t">Contratista · WOODCONCEPT S.A.</div>
          <label class="field-label">Nombre</label>
          <input class="field-input" data-f="cNombre" value="${esc(s.cNombre)}">
          <label class="field-label">Cargo</label>
          <input class="field-input" data-f="cCargo" value="${esc(s.cCargo)}">
          <div class="acta-sigrow"><button class="btn-primary btn-sm" data-a="sign-c">✍ Firmar</button><span id="acta-sc"></span></div>
        </div>
        <div class="acta-grp">
          <div class="acta-grp-t">Contratante</div>
          <label class="field-label">Nombre</label>
          <input class="field-input" data-f="kNombre" value="${esc(s.kNombre)}">
          <label class="field-label">Cargo</label>
          <input class="field-input" data-f="kCargo" value="${esc(s.kCargo)}">
          <label class="field-label">Empresa</label>
          <input class="field-input" data-f="kEmpresa" value="${esc(s.kEmpresa)}">
          <div class="acta-sigrow"><button class="btn-primary btn-sm" data-a="sign-k">✍ Firmar</button><span id="acta-sk"></span></div>
        </div>
        <div class="acta-actions">
          <button class="btn-primary" data-a="print">🖨 Imprimir / PDF</button>
          <button class="btn-secondary" data-a="save">💾 Guardar acta</button>
          <button class="btn-secondary" data-a="attach">📷 Adjuntar acta firmada en papel</button>
          <input type="file" id="acta-file" accept="image/*,application/pdf" style="display:none">
        </div>
        <div class="acta-msg" id="acta-msg"></div>
        <div id="acta-foto"></div>
        <div class="acta-grp-t" style="margin-top:14px">Actas guardadas de este proyecto</div>
        <div id="acta-list"><div class="cron-faint" style="padding:8px 0">Cargando…</div></div>
      </div>
    </div>
    <div class="acta-prev-t">Vista previa</div>
    <div id="acta-prev"></div>
  </div>
</div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    this._bind(ov);
    this._sigStatus();
    this._fotoStatus();
    this._prev();
  },

  close() {
    document.getElementById('acta-overlay')?.remove();
    document.body.style.overflow = '';
  },

  _prev() {
    const p = document.getElementById('acta-prev');
    if (p) p.innerHTML = this._docHtml();
  },

  _msg(text, kind = '') {
    const m = document.getElementById('acta-msg');
    if (m) { m.textContent = text; m.className = 'acta-msg ' + kind; }
  },

  _sigStatus() {
    const s = this._st;
    const fill = (id, img, who) => {
      const e = document.getElementById(id);
      if (!e) return;
      e.innerHTML = img
        ? `<img src="${img}" alt="Firma"> <span style="color:#15803d">✔ Firmado</span> <button class="acta-link" data-a="clear-${who}">Borrar firma</button>`
        : '<span class="cron-faint">Sin firma</span>';
    };
    fill('acta-sc', s.firmaC, 'c');
    fill('acta-sk', s.firmaK, 'k');
  },

  _fotoStatus() {
    const e = document.getElementById('acta-foto');
    if (!e) return;
    e.innerHTML = this._st.fotoUrl
      ? `<div style="font-size:13px;margin-bottom:6px">📎 <a href="${esc(this._st.fotoUrl)}" target="_blank" rel="noopener">Ver acta firmada en papel</a></div>` : '';
  },

  _bind(ov) {
    const s = this._st;
    ov.addEventListener('input', e => {
      const f = e.target.dataset?.f;
      if (!f) return;
      s[f] = e.target.value;
      if (f === 'cotizacion') this._cotManual = true;
      if (f === 'cNombre' || f === 'cCargo') {
        try { localStorage.setItem(this._LS, JSON.stringify({ nombre: s.cNombre, cargo: s.cCargo })); } catch {}
      }
      this._prev();
    });
    ov.addEventListener('change', async e => {
      const t = e.target;
      if (t.dataset?.op) {
        if (t.checked) s.opIds.add(t.dataset.op); else s.opIds.delete(t.dataset.op);
        if (!this._cotManual) {
          s.cotizacion = this._cotAuto();
          const inp = ov.querySelector('[data-f="cotizacion"]');
          if (inp) inp.value = s.cotizacion;
        }
        this._prev();
      } else if (t.id === 'acta-file') {
        const file = t.files?.[0];
        t.value = '';
        if (file) await this._attach(file);
      }
    });
    ov.addEventListener('click', async e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'close')        this.close();
      else if (a === 'print')   this._print();
      else if (a === 'save')    await this._save(b);
      else if (a === 'attach')  document.getElementById('acta-file')?.click();
      else if (a === 'sign-c')  this._openPad(`Firma — ${s.cNombre || 'Contratista'} (WOODCONCEPT S.A.)`, img => { s.firmaC = img; this._sigStatus(); this._prev(); });
      else if (a === 'sign-k')  this._openPad(`Firma — ${s.kNombre || 'Contratante'}`, img => { s.firmaK = img; this._sigStatus(); this._prev(); });
      else if (a === 'clear-c') { s.firmaC = null; this._sigStatus(); this._prev(); }
      else if (a === 'clear-k') { s.firmaK = null; this._sigStatus(); this._prev(); }
      else if (a === 'open-acta') this._openSaved(b.dataset.id);
      else if (a === 'del-acta')  await this._delete(b.dataset.id);
    });
  },

  // ── Firma en pantalla ────────────────────────────────────────
  _openPad(title, done) {
    const ov = document.createElement('div');
    ov.className = 'acta-sig-ov';
    ov.innerHTML = `
      <div class="acta-sig-top"><b>${esc(title)}</b><span>Firme con el dedo dentro del recuadro (si es celular, gírelo en horizontal antes de firmar).</span></div>
      <div class="acta-sig-box"><canvas></canvas><div class="acta-sig-guide"></div><div class="acta-sig-x">✕</div></div>
      <div class="acta-sig-btns">
        <button class="btn-secondary" data-p="clear">Borrar</button>
        <button class="btn-secondary" data-p="cancel">Cancelar</button>
        <button class="btn-primary" data-p="ok">Listo</button>
      </div>`;
    document.body.appendChild(ov);

    const box = ov.querySelector('.acta-sig-box');
    const cv  = ov.querySelector('canvas');
    const strokes = [];
    let cur = null;

    const paint = (g, w, h, ox, oy, k, lw) => {
      g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111'; g.fillStyle = '#111';
      for (const st of strokes) {
        const p = st.map(q => ({ x: (q.x * w - ox) * k, y: (q.y * h - oy) * k }));
        if (p.length === 1) { g.beginPath(); g.arc(p[0].x, p[0].y, lw / 2, 0, Math.PI * 2); g.fill(); continue; }
        g.beginPath(); g.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length - 1; i++) {
          g.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
        }
        g.lineTo(p[p.length - 1].x, p[p.length - 1].y);
        g.stroke();
      }
    };
    const redraw = () => {
      const w = box.clientWidth, h = box.clientHeight, dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      paint(g, w, h, 0, 0, 1, 2.8);
    };
    const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };

    cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); redraw(); });
    cv.addEventListener('pointermove', e => { if (!cur) return; e.preventDefault(); cur.push(pt(e)); redraw(); });
    ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => { cur = null; }));
    window.addEventListener('resize', redraw);
    requestAnimationFrame(redraw);

    const finish = () => { window.removeEventListener('resize', redraw); ov.remove(); };
    const exportPng = () => {
      const w = box.clientWidth, h = box.clientHeight;
      const pts = strokes.flat();
      if (pts.length < 3) return null;
      const xs = pts.map(p => p.x * w), ys = pts.map(p => p.y * h), pad = 8;
      const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
      const bw = Math.max(...xs) + pad - minX, bh = Math.max(...ys) + pad - minY;
      const k = Math.min(1, 700 / bw);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(bw * k)); out.height = Math.max(1, Math.round(bh * k));
      paint(out.getContext('2d'), w, h, minX, minY, k, Math.max(1.8, 2.8 * k));
      return out.toDataURL('image/png');
    };
    ov.addEventListener('click', e => {
      const p = e.target.closest('[data-p]')?.dataset.p;
      if (p === 'clear')  { strokes.length = 0; redraw(); }
      if (p === 'cancel') finish();
      if (p === 'ok') {
        const img = exportPng();
        if (!img) { alert('Dibuje la firma dentro del recuadro.'); return; }
        finish();
        done(img);
      }
    });
  },

  // ── Guardado (Supabase: actas_entrega) ───────────────────────
  _record() {
    const s = this._st;
    return {
      id: s.id,
      proyecto: s.proyecto,
      proyecto_key: this._proj,
      contratante: s.contratante,
      cotizacion: s.cotizacion,
      ops: this._ops.filter(o => s.opIds.has(o.id)).map(o => ({ id: o.id, noOp: o.noOp, name: o.name })),
      fecha: s.fecha || null,
      observaciones: s.obs,
      contratista_nombre: s.cNombre, contratista_cargo: s.cCargo,
      contratante_nombre: s.kNombre, contratante_cargo: s.kCargo, contratante_empresa: s.kEmpresa,
      firma_contratista: s.firmaC, firma_contratante: s.firmaK,
      foto_url: s.fotoUrl,
    };
  },

  async _save(btn) {
    const s = this._st;
    if (!s.id) s.id = (crypto.randomUUID ? crypto.randomUUID() : 'a' + Date.now() + Math.random().toString(16).slice(2));
    if (btn) btn.disabled = true;
    this._msg('Guardando…');
    try {
      await DB.saveActa(this._record());
      this._msg('✔ Acta guardada', 'ok');
      await this._loadList();
      return true;
    } catch (e) {
      this._msg('No se pudo guardar: ' + (e.message || e) + ' — ¿ya se creó la tabla actas_entrega en Supabase?', 'err');
      return false;
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async _attach(file) {
    this._msg('Subiendo acta firmada…');
    try {
      const url = await DB.uploadFoto('actas', file);
      this._st.fotoUrl = url;
      this._fotoStatus();
      if (!(await this._save())) return;
      this._msg('✔ Acta firmada adjuntada y guardada', 'ok');
    } catch (e) {
      this._msg('No se pudo subir el archivo: ' + (e.message || e), 'err');
    }
  },

  async _loadList() {
    const box = document.getElementById('acta-list');
    try {
      this._list = await DB.getActas(this._proj);
      this._listErr = null;
    } catch (e) {
      this._list = [];
      this._listErr = e.message || String(e);
    }
    if (!box) return;
    if (this._listErr) { box.innerHTML = `<div class="cron-faint" style="padding:8px 0">No se pudo cargar el historial (${esc(this._listErr)}).</div>`; return; }
    if (!this._list.length) { box.innerHTML = '<div class="cron-faint" style="padding:8px 0">Todavía no hay actas guardadas.</div>'; return; }
    box.innerHTML = this._list.map(r => {
      const f = this._parseDate(r.fecha);
      const fecha = f ? `${f.getDate()} ${this._MESES[f.getMonth()].slice(0, 3)} ${f.getFullYear()}` : '—';
      const firmas = [r.firma_contratista ? 'Woodconcept' : null, r.firma_contratante ? 'Contratante' : null].filter(Boolean).join(' + ');
      return `<div class="acta-list-i">
        <span><b>${esc(fecha)}</b> · ${esc(r.cotizacion || '—')}<br><span style="color:#888">${firmas ? '✔ Firmas: ' + esc(firmas) : 'Sin firmas'}${r.foto_url ? ' · 📎 papel' : ''}</span></span>
        <span><button class="btn-secondary btn-sm" data-a="open-acta" data-id="${esc(r.id)}">Abrir</button>
        <button class="btn-secondary btn-sm" data-a="del-acta" data-id="${esc(r.id)}" title="Borrar">🗑</button></span>
      </div>`;
    }).join('');
  },

  _openSaved(id) {
    const r = this._list.find(x => x.id === id);
    if (!r) return;
    const ids = new Set((r.ops || []).map(o => o.id));
    this._st = {
      id: r.id,
      proyecto: r.proyecto || this._proj,
      contratante: r.contratante || '',
      opIds: ids,
      cotizacion: r.cotizacion || '',
      fecha: r.fecha || todayIso(),
      obs: r.observaciones || '',
      cNombre: r.contratista_nombre || '', cCargo: r.contratista_cargo || '',
      kNombre: r.contratante_nombre || '', kCargo: r.contratante_cargo || '', kEmpresa: r.contratante_empresa || '',
      firmaC: r.firma_contratista || null, firmaK: r.firma_contratante || null,
      fotoUrl: r.foto_url || null,
    };
    this._cotManual = true;
    this._build();
    this._loadList();
  },

  async _delete(id) {
    if (!confirm('¿Borrar esta acta guardada?')) return;
    try {
      await DB.deleteActa(id);
      if (this._st.id === id) this._st.id = null;
      await this._loadList();
    } catch (e) { this._msg('No se pudo borrar: ' + (e.message || e), 'err'); }
  },
};
