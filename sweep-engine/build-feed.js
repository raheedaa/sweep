/* ============================================================
   The Sweep — morning engine
   fetch RSS  ->  clean & dedupe  ->  (Claude enrich)  ->  economy  ->  write feed.json
   Deterministic where possible; Claude only for the writing/curation.
   Runs with zero config; richer if ANTHROPIC_API_KEY is set.
   ============================================================ */
import Parser from 'rss-parser';
import { readFile, writeFile } from 'node:fs/promises';

const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': 'sweep-engine/1.0' } });
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';

const cfg = JSON.parse(await readFile('config.json', 'utf8'));
const { feeds } = JSON.parse(await readFile('sources.json', 'utf8'));

/* ---------- 1. FETCH ---------- */
function cleanUrl(u = '') {
  try { const url = new URL(u);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch { return u; }
}
function hoursAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso); if (isNaN(d)) return null;
  const h = Math.round((Date.now() - d.getTime()) / 3600000);
  if (h < 1) return 'now'; if (h < 24) return h + 'h'; return Math.round(h / 24) + 'd';
}
function normTitle(t = '') { return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }

let raw = [];
for (const f of feeds) {
  try {
    const feed = await parser.parseURL(f.url);
    for (const item of (feed.items || []).slice(0, 12)) {
      const link = cleanUrl(item.link || '');
      if (!link) continue;
      raw.push({
        title: (item.title || '').trim(),
        url: link,
        source: f.name.replace(/\s*\(Google News\)/, ''),
        category: f.category,
        date: item.isoDate || item.pubDate || null,
        snippet: (item.contentSnippet || item.summary || '').replace(/\s+/g, ' ').trim().slice(0, 300)
      });
    }
    console.log(`  ok  ${f.name} (${feed.items?.length || 0})`);
  } catch (e) { console.log(`  --  ${f.name} failed: ${e.message}`); }
}

/* ---------- 2. CLEAN & DEDUPE ---------- */
const seenUrl = new Set(), seenTitle = new Set();
let items = [];
for (const it of raw) {
  if (!it.title || it.title.length < 12) continue;
  if (seenUrl.has(it.url)) continue;
  const nt = normTitle(it.title);
  if (seenTitle.has(nt)) continue;
  seenUrl.add(it.url); seenTitle.add(nt);
  items.push(it);
}
// newest first
items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
const top = items.slice(0, cfg.maxItemsToEnrich || 22);
console.log(`\n${items.length} unique items; enriching top ${top.length}`);

/* ---------- 3. ECONOMY (World Bank, keyless) ---------- */
async function wb(code, indicator) {
  try {
    const r = await fetch(`https://api.worldbank.org/v2/country/${code}/indicator/${indicator}?format=json&mrnev=1`);
    const j = await r.json();
    const row = j?.[1]?.[0];
    return row ? { value: row.value, year: row.date } : null;
  } catch { return null; }
}
async function economy() {
  const out = [];
  for (const loc of (cfg.economy || [])) {
    const gdp = await wb(loc.code, 'NY.GDP.MKTP.KD.ZG');   // GDP growth %
    const inf = await wb(loc.code, 'FP.CPI.TOTL.ZG');       // inflation %
    const metrics = [];
    if (gdp) metrics.push({ l: `GDP growth (${gdp.year})`, v: gdp.value.toFixed(1) + '%', chg: '', dir: gdp.value >= 0 ? 'up' : 'down' });
    if (inf) metrics.push({ l: `Inflation (${inf.year})`, v: inf.value.toFixed(1) + '%', chg: '', dir: '' });
    if (metrics.length) out.push({ scope: loc.scope, flag: loc.flag, metrics });
  }
  return out;
}

/* ---------- 4. ENRICH (Claude, optional) ---------- */
function fallbackFeed() {
  const feed = top.map((it, i) => ({
    id: 's' + i, category: it.category, mustRead: i < (cfg.mustReadCount || 3),
    headline: it.title, source: it.source, time: hoursAgo(it.date) || '',
    peek: it.snippet || '', summary: it.snippet ? [it.snippet] : [], why: '', simple: '',
    spectrum: null, sources: [{ name: it.source, url: it.url, lean: 'center' }]
  }));
  const byCat = {};
  top.forEach(it => { (byCat[it.category] ||= []).push(it); });
  const clusters = Object.entries(byCat).slice(0, 4).map(([cat, arr]) => ({
    title: cat, bullets: arr.slice(0, 3).map(x => x.title), why: '', highlights: [],
    sources: arr.slice(0, 3).map(x => ({ name: x.source, url: x.url }))
  }));
  return { feed, brief: { clusters } };
}

async function enrich() {
  if (!API_KEY) { console.log('No ANTHROPIC_API_KEY — writing clean headlines only.'); return fallbackFeed(); }
  const list = top.map((it, i) => `[${i}] (${it.category}) ${it.title} — ${it.source}${it.snippet ? ' :: ' + it.snippet : ''} :: ${it.url}`).join('\n');
  const prompt = `You are the editor of a personal morning intelligence brief for ${cfg.greetingName}, whose interests are: ${cfg.interests.join('; ')}.

Below are today's cleaned news items (index, category, headline, source, snippet, url). Curate them into a JSON object. Be accurate, neutral and concise. Never invent facts beyond the snippets; if unsure, keep it factual and short.

ITEMS:
${list}

Return ONLY valid JSON (no markdown) with this exact shape:
{
 "feed": [ { "id":"s0","category":"<one of the item categories>","mustRead":true|false,
   "headline":"<clear headline>","source":"<primary source>","time":"<leave empty, we fill>",
   "peek":"<1 sentence teaser>","summary":["<3 short key points>"],
   "why":"<1-2 sentences: why it matters specifically to ${cfg.greetingName}'s interests>",
   "simple":"<explain like I'm 5, 1 sentence>",
   "spectrum":{"left":<int>,"center":<int>,"right":<int>},
   "sources":[{"name":"<source>","url":"<url>","lean":"left|center|right"}] } ],
 "brief": { "clusters":[ { "title":"<theme>","bullets":["<3-4 short lines>"],
   "why":"<1 sentence why it matters to her>","highlights":[<indexes of the 1-2 most skim-worthy bullets>],
   "sources":[{"name":"<source>","url":"<url>"}] } ] },
 "signals": [ { "text":"<1 line>","tag":"<short tag>","dir":"up|down|","url":"<url>" } ],
 "progress": [ { "tag":"Opportunity|Discovery|Idea","title":"<short>","body":"<1 sentence>","url":"<url>" } ]
}
Include every item worth reading in "feed" (mark ${cfg.mustReadCount || 3} as mustRead). Give 3-4 brief clusters, 3 signals, 3 progress cards. spectrum values should sum to ~100 and reflect how left/center/right outlets would cover it.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 6000, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) { console.log('Claude call failed:', r.status, await r.text()); return fallbackFeed(); }
  const j = await r.json();
  let text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  text = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(text);
    // restore url + time from our clean data where the model referenced an index
    parsed.feed = (parsed.feed || []).map((f, i) => {
      const src = top[i] || {};
      return { ...f, time: hoursAgo(src.date) || f.time || '',
        sources: (f.sources && f.sources.length) ? f.sources : [{ name: src.source, url: src.url, lean: 'center' }] };
    });
    return parsed;
  } catch (e) { console.log('Could not parse Claude JSON, using fallback:', e.message); return fallbackFeed(); }
}

/* ---------- 5. WRITE ---------- */
const enriched = await enrich();
const econ = await economy();
const out = {
  updatedAt: new Date().toISOString(),
  feed: enriched.feed || [],
  brief: {
    date: new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }),
    greeting: `Good morning, ${cfg.greetingName}`,
    clusters: enriched.brief?.clusters || []
  },
  monitor: {
    economy: econ,
    signals: enriched.signals || [],
    progress: enriched.progress || []
  },
  learn: cfg.learn || []
};
await writeFile('feed.json', JSON.stringify(out, null, 2));
console.log(`\nWrote feed.json — ${out.feed.length} stories, ${out.brief.clusters.length} brief clusters, ${econ.length} economies.`);
