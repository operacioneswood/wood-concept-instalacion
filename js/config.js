// ─────────────────────────────────────────────────────────────
// js/config.js — Configuration and shared utilities
// ─────────────────────────────────────────────────────────────

// ── ClickUp statuses tracked here ───────────────────────────
// "empaque" = ya salió de fábrica, lista para enviar a sitio.
// "en instalacion" = en instalación ahora mismo.
const INSTALL_STATUSES = new Set(['empaque', 'en instalacion']);

// Root-project statuses this whole app is allowed to show. An OP piece can
// carry a stale "empaque"/"en instalación" status even after its project
// is fully closed out — gating on the project's own status (not just the
// piece's) is what keeps finished projects out of the bitácora.
const PROJECT_ACTIVE_STATUSES = new Set(['fabrica', 'en instalacion']);

// Fábrica statuses shown read-only in the Cronograma tab (same set
// wood-concept-planta tracks as "in plant").
const ACTIVE_STATUSES = new Set(['fabrica', 'corte', 'enchape', 'ebanisteria', 'en ebanisteria', 'en pintura', 'pendiente de revision', 'reproceso', 'pendiente por obra', 'pendiente chapilla']);

const STATUS_DISPLAY = {
  'fabrica':               { label: 'Fábrica',              cls: 'sb-green'  },
  'en ebanisteria':        { label: 'En Ebanistería',       cls: 'sb-amber'  },
  'en pintura':            { label: 'En Pintura',           cls: 'sb-purple' },
  'pendiente de revision': { label: 'Pend. Revisión',       cls: 'sb-gray'   },
  'reproceso':             { label: 'Reproceso',            cls: 'sb-repro'  },
  'pendiente por obra':    { label: 'Pend. por Obra',       cls: 'sb-obra'   },
  'pendiente chapilla':    { label: 'Pend. Chapilla',       cls: 'sb-chapilla' },
};

const INSTALL_STATUS_DISPLAY = {
  'empaque':        { label: 'Empaque',        cls: 'sb-obra'   },
  'en instalacion': { label: 'En Instalación', cls: 'sb-purple' },
};

// The 5-option "ESTATUS INSTALACIÓN" ClickUp dropdown, in workflow order —
// colors match the ones already configured on that field in ClickUp.
const ESTATUS_INSTALACION_STAGES = [
  { id: 'SIN COMENZAR',   color: '#b5bcc2' },
  { id: 'EN PROCESO',     color: '#81B1FF' },
  { id: 'EN REPARACIÓN',  color: '#e79163' },
  { id: 'RETOQUES',       color: '#b14242' },
  { id: 'COMPLETADO',     color: '#2ecd6f' },
];
const ESTATUS_INSTALACION_COLORS = Object.fromEntries(ESTATUS_INSTALACION_STAGES.map(s => [s.id, s.color]));

// ── Formulario de Reprocesos (Google Forms) ─────────────────────
// Lets the bitácora open the company's real reproceso form pre-filled
// instead of the coordinator re-typing everything from scratch. Entry IDs
// were read directly from the live form (docs.google.com/forms/d/e/
// 1FAIpQLSeBB2x_LCWqHBhl1GNYbBx5Px1FOeaRw8HMU6EaMXF_zER7sw).
const REPROCESO_FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSeBB2x_LCWqHBhl1GNYbBx5Px1FOeaRw8HMU6EaMXF_zER7sw/viewform';
const REPROCESO_FORM_ENTRIES = {
  fechaYear:  '1847747903_year',
  fechaMonth: '1847747903_month',
  fechaDay:   '1847747903_day',
  encargado:  '1264151880',
  cliente:    '1674418086',
  op:         '1601530923',
  cantidad:   '1271350687',
  acabado:    '2128723638',
  pieza:      '1110334385',
  origen:     '1602377585',   // Diseño | Fabrica | Instalacion | Cliente
  disenador:  '1286190452',
  motivo:     '1149267137',
};

function buildReprocesoFormUrl({ cliente, op, motivo } = {}) {
  const now = new Date();
  const params = new URLSearchParams({ usp: 'pp_url' });
  params.set(`entry.${REPROCESO_FORM_ENTRIES.fechaYear}`,  String(now.getFullYear()));
  params.set(`entry.${REPROCESO_FORM_ENTRIES.fechaMonth}`, String(now.getMonth() + 1));
  params.set(`entry.${REPROCESO_FORM_ENTRIES.fechaDay}`,   String(now.getDate()));
  params.set(`entry.${REPROCESO_FORM_ENTRIES.origen}`, 'Instalacion');
  if (cliente) params.set(`entry.${REPROCESO_FORM_ENTRIES.cliente}`, cliente);
  if (op)      params.set(`entry.${REPROCESO_FORM_ENTRIES.op}`,      op);
  if (motivo)  params.set(`entry.${REPROCESO_FORM_ENTRIES.motivo}`,  motivo);
  return `${REPROCESO_FORM_BASE}?${params.toString()}`;
}

// ── Default ClickUp connection ────────────────────────────────
// Key stored in localStorage takes priority over this default.
const DEFAULT_API_KEY = 'pk_88470791_HQLTVBC5M58X1SD3H6BHDSYQFLIX931H';
const DEFAULT_LIST_ID = '90090072307';

// ── Shared utilities ──────────────────────────────────────────
const normStr = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const esc     = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const el      = id => document.getElementById(id);

function tsToDate(ms) {
  if (ms === null || ms === undefined || ms === '') return null;
  const n = Number(ms);
  return isNaN(n) || n === 0 ? null : new Date(n);
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
