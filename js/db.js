// ─────────────────────────────────────────────────────────────
// js/db.js — Supabase client + CRUD operations for Instalación
//
// Uses the SAME Supabase project as wood-concept-planta — this app
// only reads/writes the tables it needs (asignaciones with
// etapa='instalacion', plus its own bitacora_instalacion and
// instalacion_ops), so both apps can run side by side safely.
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL  = 'https://uldbmnvstmeukkqdunnz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZGJtbnZzdG1ldWtrcWR1bm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NzY2MDEsImV4cCI6MjA5NzQ1MjYwMX0.SvaLILKDyO-c9Hl4OQktBjQYysvMkK9wRsh-JxiNPmo';

const DB = {
  _sb: null,

  init() {
    this._sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  },

  async _q(fn) {
    const { data, error } = await fn(this._sb);
    if (error) { console.error('[DB]', error.message); throw error; }
    return data;
  },

  // ════════════════════════════════════════════════════════
  // ASIGNACIONES  (reused from planta — op_id + etapa + persona = unique.
  // This app only ever writes etapa='instalacion' rows.)
  // ════════════════════════════════════════════════════════
  async getAsignaciones() {
    return this._q(sb => sb.from('asignaciones').select('*').eq('etapa', 'instalacion'));
  },

  async setAsignacion(op_id, etapa, persona, fecha_asignacion = null, comentario = null) {
    return this._q(sb => sb.from('asignaciones').upsert(
      { op_id, etapa, persona,
        fecha_asignacion: fecha_asignacion || new Date().toISOString().slice(0, 10),
        comentario: comentario ?? null,
      },
      { onConflict: 'op_id,etapa,persona' }
    ));
  },

  async removeAsignacion(op_id, persona = null, etapa = null) {
    let q = this._sb.from('asignaciones').delete().eq('op_id', op_id);
    if (persona) q = q.eq('persona', persona);
    if (etapa)   q = q.eq('etapa', etapa);
    const { error } = await q;
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════════
  // BITACORA_INSTALACION  (event log per OP: notas, pausas, cambios en
  // sitio, reprocesos)
  // ════════════════════════════════════════════════════════
  async getBitacoraInstalacion() {
    return this._q(sb => sb.from('bitacora_instalacion').select('*').order('created_at', { ascending: false }));
  },

  async addBitacoraEntry({ op_id, tipo = 'nota', texto = null, autor = null, es_reproceso = false }) {
    return this._q(sb => sb.from('bitacora_instalacion')
      .insert({ op_id, tipo, texto, autor, es_reproceso })
      .select().single());
  },

  async deleteBitacoraEntry(id) {
    const { error } = await this._sb.from('bitacora_instalacion').delete().eq('id', id);
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════════
  // INSTALACION_OPS  (per-OP install tracking that ClickUp has no field
  // for: fecha de fin real, y si la OP llegó completa desde fábrica)
  // ════════════════════════════════════════════════════════
  async getInstalacionOps() {
    return this._q(sb => sb.from('instalacion_ops').select('*'));
  },

  async upsertInstalacionOp({ op_id, fecha_fin, llego_completa, faltante, dias_estimados }) {
    const row = { op_id, updated_at: new Date().toISOString() };
    if (fecha_fin       !== undefined) row.fecha_fin      = fecha_fin;
    if (llego_completa  !== undefined) row.llego_completa = llego_completa;
    if (faltante        !== undefined) row.faltante       = faltante;
    if (dias_estimados  !== undefined) row.dias_estimados = dias_estimados;
    return this._q(sb => sb.from('instalacion_ops').upsert(row, { onConflict: 'op_id' }).select().single());
  },

  // ════════════════════════════════════════════════════════
  // SETUP — create tables if they don't exist (run once in the
  // Supabase SQL editor; kept here for reference)
  // ════════════════════════════════════════════════════════
  SETUP_SQL: `
    create table if not exists bitacora_instalacion (
      id               uuid primary key default gen_random_uuid(),
      op_id            text not null,
      tipo             text not null default 'nota',
      texto            text,
      autor            text,
      es_reproceso     boolean not null default false,
      created_at       timestamptz not null default now()
    );

    create table if not exists instalacion_ops (
      op_id            text primary key,
      fecha_fin        date,
      llego_completa   boolean,
      faltante         text,
      dias_estimados   integer,
      updated_at       timestamptz not null default now()
    );
  `,
};
