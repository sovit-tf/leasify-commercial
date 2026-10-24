'use strict';
/* =====================================================================
   Unit card pictures for WhatsApp.

     GET /media/unit/<unit id>.png    a 1000 x 1000 PNG: the illustration used in the app (LC.photo)
                                      plus a text band with the headline numbers.

   Public on purpose: Meta fetches the picture from its own servers. Only real unit ids are served,
   and the picture holds nothing about the owner, the occupier or any person. Pictures are cached in
   memory and re-drawn when a unit's numbers change.
   ===================================================================== */
const sharp = require('sharp');
const { escXml, cut } = require('./util');

const W = 1000, PHOTO_H = 600, H = 1000;
const FONT = "'DejaVu Sans', 'Liberation Sans', Arial, Helvetica, sans-serif";
const CACHE_MAX = 200;

/** Wrap text to at most `lines` lines of about `width` characters. */
function wrap(text, width, lines) {
  const words = String(text || '').split(/\s+/).filter(Boolean); const out = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { const keep = out.slice(0, lines); keep[lines - 1] = cut(keep[lines - 1], width - 1) + '…'; return keep; }
  return out;
}

/** The inside of the app's illustration (everything between the outer <svg> tags). */
function photoInner(LC, u) {
  const uri = LC.photo(u);
  const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

function cardSvg(LC, u) {
  const inner = photoInner(LC, u);
  const fmt = (n) => LC.fmtNum(n);
  const title = wrap(u.listing_title || u.building_name, 36, 2);
  const place = [u.locality, LC.cityOf(u)].filter(Boolean).join(', ');
  const y0 = PHOTO_H;
  let t = '';
  title.forEach((line, i) => { t += '<text x="48" y="' + (y0 + 60 + i * 46) + '" font-size="40" font-weight="700" fill="#ffffff">' + escXml(line) + '</text>'; });
  const yp = y0 + 60 + (title.length - 1) * 46 + 40;
  t += '<text x="48" y="' + yp + '" font-size="27" fill="#aab4c5">' + escXml(cut(place, 54)) + '</text>';
  const yb = yp + 72;
  t += '<text x="48" y="' + yb + '" font-size="60" font-weight="700" fill="#ffffff">₹' + escXml(u.all_in_per_sqft) + '/sq ft</text>';
  t += '<text x="' + (48 + 20 + 320) + '" y="' + yb + '" font-size="28" fill="#aab4c5">all-in</text>';
  t += '<text x="48" y="' + (yb + 46) + '" font-size="34" font-weight="700" fill="#7fe0b4">' + escXml(LC.fmtLakh(u.all_in_monthly)) + ' a month, all-in</text>';
  t += '<text x="48" y="' + (yb + 94) + '" font-size="27" fill="#dfe6f1">' + escXml(fmt(u.chargeable_sqft) + ' sq ft chargeable   |   ' + u.furnishing) + '</text>';
  t += '<text x="48" y="' + (yb + 132) + '" font-size="27" fill="#dfe6f1">' + escXml('Available from ' + LC.fmtDate(u.available_from)) + '</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + FONT + '">' +
    '<rect width="' + W + '" height="' + H + '" fill="#0f1b2d"/>' +
    '<svg x="0" y="0" width="' + W + '" height="' + PHOTO_H + '" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">' + inner + '</svg>' +
    '<rect x="0" y="' + (PHOTO_H - 64) + '" width="' + W + '" height="64" fill="#0f1b2d" fill-opacity=".55"/>' +
    '<text x="48" y="' + (PHOTO_H - 22) + '" font-size="30" font-weight="700" fill="#ffffff">' + escXml(u.unit_id) + '  |  ' + escXml(u.property_type) + '</text>' +
    t +
    '<text x="' + (W - 48) + '" y="' + (H - 30) + '" font-size="22" text-anchor="end" fill="#8591a5">Sample listing</text>' +
    '</svg>';
}

const versionKey = (u) => [u.unit_id, u.listing_title, u.locality, u.city, u.property_type, u.all_in_per_sqft, u.all_in_monthly, u.chargeable_sqft, u.furnishing, u.available_from].join('|');

function register(ctx) {
  const { app, rt, log } = ctx;
  const LC = rt.LC;
  const cache = new Map();                    // unit id -> { key, png }

  async function render(u) {
    const key = versionKey(u); const hit = cache.get(u.unit_id);
    if (hit && hit.key === key) return hit.png;
    const png = await sharp(Buffer.from(cardSvg(LC, u))).png({ compressionLevel: 9 }).toBuffer();
    cache.delete(u.unit_id); cache.set(u.unit_id, { key, png });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return png;
  }
  ctx.media = { render, cardSvg: (u) => cardSvg(LC, u) };

  app.get('/media/unit/:file', async (req, res) => {
    const m = /^([A-Za-z0-9-]{1,24})\.png$/.exec(req.params.file || '');
    const u = m && (rt.state.units || []).find((x) => x.unit_id === m[1]);
    if (!u) return res.status(404).type('text/plain').send('Not found');
    try {
      const png = await render(u);
      res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Content-Length': String(png.length) }).end(png);
    } catch (e) {
      log.error('[media] could not draw', m[1], e.message);
      res.status(500).type('text/plain').send('Could not draw this picture');
    }
  });
}

module.exports = { register, cardSvg };
