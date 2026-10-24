'use strict';
/* =====================================================================
   Access rules: what each role can read (filters) and write (rules).
   Pure functions over a context { LC, state }. No I/O.

   Read  ceo, manager   everything
         executive      everything, owner phone masked on units that are not theirs
         owner          only their units, visits on them (no client details), reduced clients,
                        owner-check tasks, unit audit rows. No leads, queue, consent.
   Write see authorizeUpsert / authorizeRemove below (ARCHITECTURE.md, "Write rules").
   ===================================================================== */

const STAFF = new Set(['ceo', 'manager', 'executive']);
const ADMIN = new Set(['ceo', 'manager']);

/** +91 9964X XXX60 -> +91 9XXXX XX460 (keeps the last three digits only) */
function maskPhone(p) {
  if (p == null || p === '') return p;
  const digits = String(p).replace(/\D/g, '');
  return '+91 9XXXX XX' + digits.slice(-3).padStart(3, 'X');
}

function makeCtx(LC, state) {
  const ownerUnits = new Map(); const ownerVisitClients = new Map();
  return {
    LC, state,
    unitsOf(owner) {
      if (!ownerUnits.has(owner)) ownerUnits.set(owner, new Set((state.units || []).filter((u) => u.owner_name === owner).map((u) => u.unit_id)));
      return ownerUnits.get(owner);
    },
    visitClientsOf(owner) {
      if (!ownerVisitClients.has(owner)) {
        const own = this.unitsOf(owner);
        ownerVisitClients.set(owner, new Set((state.visits || []).filter((v) => own.has(v.unitId)).map((v) => v.clientId)));
      }
      return ownerVisitClients.get(owner);
    },
    client(id) { return (state.clients || []).find((c) => c.id === id) || null; },
  };
}

const CLIENT_FIELDS_OWNER_NEVER_SEES = ['name', 'company', 'phone', 'email', 'clientName', 'client', 'contact'];

function ownerClientView(c, ctx, owner) {
  const own = ctx.unitsOf(owner);
  const shared = (c.shared || []).filter((x) => own.has(x.unitId)).map((x) => ({ unitId: x.unitId, ts: x.ts, reaction: x.reaction == null ? null : x.reaction }));
  const mine = !!(c.unitId && own.has(c.unitId));
  const docs = (c.timeline || []).filter((e) => e.type === 'document' && [...own].some((id) => String(e.text).indexOf('for ' + id) >= 0)).map((e) => ({ ts: e.ts, type: e.type, text: e.text }));
  if (!shared.length && !mine && !docs.length && !ctx.visitClientsOf(owner).has(c.id)) return null;
  return {
    id: c.id, stage: c.stage, shared, unitId: mine ? c.unitId : null, updatedAt: c.updatedAt,
    stageHistory: (c.stageHistory || []).map((h) => ({ stage: h.stage, ts: h.ts })), timeline: docs,
  };
}

/** The record as this person may see it, or null when they may not see it. */
function viewRecord(coll, rec, s, ctx) {
  if (s.role === 'ceo' || s.role === 'manager') return rec;
  if (s.role === 'executive') {
    if (coll === 'units' && rec.listing_agent !== s.name) return Object.assign({}, rec, { owner_phone: maskPhone(rec.owner_phone) });
    return rec;
  }
  if (s.role !== 'owner' || !s.owner) return null;
  const own = ctx.unitsOf(s.owner);
  switch (coll) {
    case 'units': return rec.owner_name === s.owner ? rec : null;
    case 'visits': {
      if (!own.has(rec.unitId)) return null;
      const v = Object.assign({}, rec); CLIENT_FIELDS_OWNER_NEVER_SEES.forEach((k) => { delete v[k]; }); return v;
    }
    case 'clients': return ownerClientView(rec, ctx, s.owner);
    case 'tasks': return rec.type === 'Owner check' && own.has(rec.unitId) ? rec : null;
    case 'audit': return own.has(rec.unitId) ? rec : null;
    case 'activity': return rec.kind === 'owner' && own.has(rec.unitId) ? rec : null;
    case 'settings': return rec;
    default: return null;            // leads, queue, consent, syncLog
  }
}

/** Filter a whole state object for a person (the bootstrap payload). */
function viewState(state, s, LC, COLLECTIONS) {
  const ctx = makeCtx(LC, state); const out = {};
  for (const k of Object.keys(COLLECTIONS)) {
    const c = COLLECTIONS[k];
    if (c.kind === 'single') { out[k] = viewRecord(k, state[k], s, ctx); continue; }
    const arr = state[k] || [];
    const rows = [];
    for (const obj of arr) {
      const rec = c.record ? c.record(obj) : obj;
      const v = viewRecord(k, rec, s, ctx);
      if (v) rows.push(v);
    }
    out[k] = rows;
  }
  return out;
}

/* ---------------------------------------------------------------------
   Write rules
   --------------------------------------------------------------------- */
const OK = { ok: true };
const no = (reason) => ({ ok: false, reason });

function clientAgentOf(ctx, clientId) { const c = clientId ? ctx.client(clientId) : null; return c ? c.agent : null; }

function ownsVisitOrTask(rec, s, ctx) {
  const who = rec.assignee !== undefined ? rec.assignee : rec.agent;     // tasks carry an assignee, visits an agent
  return who === s.name || clientAgentOf(ctx, rec.clientId) === s.name;
}

function teamCities(LC, name) { const t = LC.teamBy(name); return t ? t.cities : []; }
function clientCity(LC, c) {
  if (!c || !c.req) return null;
  if (c.req.city) return c.req.city;
  const l = c.req.localities && c.req.localities[0]; return l && LC.LOCALITIES[l] ? LC.cityOf({ city: LC.LOCALITIES[l].city }) : null;
}

/**
 * existing = the record now in the engine (or null for a new one)
 * merged   = what it would look like after the change
 */
function authorizeUpsert(coll, existing, merged, s, ctx) {
  if (!STAFF.has(s.role)) return no('Owners cannot change records. Owner replies go through the weekly check.');
  const admin = ADMIN.has(s.role);
  switch (coll) {
    case 'units':
      if (admin) return OK;
      return (existing ? existing.listing_agent : merged.listing_agent) === s.name ? OK : no('You can only change units where you are the listing agent.');
    case 'clients':
      if (admin || !existing) return OK;
      return existing.agent === s.name ? OK : no('You can only change clients assigned to you (' + existing.agent + ' has this one).');
    case 'visits':
    case 'tasks':
      if (admin) return OK;
      return ownsVisitOrTask(existing || merged, s, ctx) ? OK : no('You can only change ' + coll + ' that are yours or for your clients.');
    case 'queue':
      if (admin) return OK;
      if (!existing) return no('Handoff items are created by the agent, not by people.');
      if (existing.assignee === s.name) return OK;
      return teamCities(ctx.LC, s.name).includes(clientCity(ctx.LC, ctx.client(existing.clientId))) ? OK : no('This handoff is assigned to ' + existing.assignee + ' in another area.');
    case 'settings':
      return s.role === 'ceo' ? OK : no('Only the CEO can change settings.');
    default:
      return no('This collection cannot be written from the app.');
  }
}

function authorizeRemove(coll, existing, s, ctx) {
  if (!STAFF.has(s.role)) return no('Owners cannot remove records.');
  if (!existing) return OK;
  if (coll === 'units' || coll === 'leads' || coll === 'queue' || coll === 'settings') return no('This record cannot be deleted.');
  if (ADMIN.has(s.role)) return OK;
  return authorizeUpsert(coll, existing, existing, s, ctx);
}

module.exports = { STAFF, ADMIN, maskPhone, makeCtx, viewRecord, viewState, authorizeUpsert, authorizeRemove };
