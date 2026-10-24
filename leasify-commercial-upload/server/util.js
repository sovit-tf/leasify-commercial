'use strict';
/* Small shared helpers for the live modules (ai, media, whatsapp, sim). Not loaded as a module by itself. */

const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');
const lastTen = (s) => digits(s).slice(-10);

/** For logs: keep only the last three digits of anything that looks like a phone number. */
function maskNum(s) {
  const d = digits(s);
  return d.length <= 3 ? 'XXX' : 'X'.repeat(d.length - 3) + d.slice(-3);
}

/** Replace phone-like digit runs (10 or more digits; spaces, dashes and a leading + allowed) in free text.
    Shorter runs are left alone so rupee amounts such as 1250000 survive. */
const PHONE_RX = /(?<![\w.])\+?\d[\d\s().-]{5,}\d(?![\w])/g;
function stripPhones(text, replacement = '[number removed]') {
  return String(text == null ? '' : text).replace(PHONE_RX, (m) => (digits(m).length >= 10 ? replacement : m));
}
/** Same idea for log lines: keep the last three digits. */
function maskPhonesForLog(text) {
  return String(text == null ? '' : text).replace(PHONE_RX, (m) => (digits(m).length >= 10 ? maskNum(m) : m));
}

/** Sliding-window limiter: allow(key) is true while the key has used fewer than `max` hits in `windowMs`. */
function rateLimiter(max, windowMs) {
  const hits = new Map();
  return {
    allow(key, now = Date.now()) {
      const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (arr.length >= max) { hits.set(key, arr); return false; }
      arr.push(now); hits.set(key, arr);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
      return true;
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const escXml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
/** First n characters (by code point) */
const cut = (s, n) => { const a = Array.from(String(s == null ? '' : s)); return a.length <= n ? a.join('') : a.slice(0, n).join(''); };

module.exports = { digits, lastTen, maskNum, stripPhones, maskPhonesForLog, rateLimiter, sleep, escXml, cut };
