/* ============================================================
   The Sweep — morning engine (ZERO dependencies)
   Needs nothing installed. Just: node build-feed.js
   fetch RSS -> clean & dedupe -> (Claude enrich) -> economy -> feed.json
   Never hard-fails: always publishes a valid feed.json.
   ============================================================ */
import { writeFile } from 'node:fs/promises';

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';

/* ---------- baked-in settings (edit here anytime) ---------- */
const CONFIG = {
  greetingName: 'Raheeda',
  interests: [
    'consumer goods & manufacturing (Eleganza)', 'premium design & branding (Revelle)',
    'furniture & design objects', 'private wealth & family business', 'Nigerian macroeconomy',
    'global economy', 'technology & AI for creative and manufacturing businesses',
    'revolutionary ideas, discoveries and opportunities'
  ],
  economy: [ { scope: 'Nigeria', code: 'NGA', flag: '\uD83C\uDDF3\uD83C\uDDEC' }, { scope: 'Global', code: 'WLD', flag: '\uD83C\uDF0D' } ],
  maxItems: 22, mustReadCount: 3,
  learn: [
    { tag: 'Strategy', title: 'Concentrate your forces', body: "Greene's Law 23: spreading thin dilutes power. Pick the one prospect, one venture, one deliverable that moves the most, and pour in until it's inevitable." },
    { tag: 'Leverage', title: 'Play long-term games with long-term people', body: "Naval's rule: compounding trust and equity beats one-off wins. Choose partners and clients you'd want to be building with in ten years." },
    { tag: 'Negotiation', title: 'Anchor, then go quiet', body: 'State your number clearly and stop talking. Silence transfers pressure to the other side and protects your position without argument.' },
    { tag: 'Craft', title: 'Ship the finished thing', body: 'A deployable draft beats a perfect plan. Reduce the loop between idea and artifact — momentum is a moat.' }
  ]
};
const SOURCES = [
  { name: 'Nairametrics', category: 'Nigeria', url: 'https://nairametrics.com/feed/' },
  { name: 'BusinessDay NG', category: 'Nigeria', url: 'https://businessday.ng/feed/' },
  { name: 'Guardian Nigeria', category: 'Nigeria', url: 'https://guardian.ng/feed/' },
  { name: 'Nigeria economy', category: 'Nigeria', url: 'https://news.google.com/rss/search?q=Nigeria+economy+OR+naira+OR+inflation+when:3d&hl=en-NG&gl=NG&ceid=NG:en' },
  { name: 'BBC Business', category: 'Global', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Guardian Business', category: 'Global', url: 'https://www.theguardian.com/uk/business/rss' },
  { name: 'NYT Business', category: 'Global', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { name: 'Economist Finance', category: 'Global', url: 'https://www.economist.com/finance-and-economics/rss.xml' },
  { name: 'BBC World', category: 'Global', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Consumer goods', category: 'Your industries', url: 'https://news.google.com/rss/search?q=(consumer+goods+OR+FMCG+OR+manufacturing)+Nigeria+OR+Africa+when:5d&hl=en&gl=US&ceid=US:en' },
  { name: 'Luxury & branding', category: 'Your industries', url: 'https://news.google.com/rss/search?q=(luxury+branding+OR+brand+identity+OR+design+studio)+when:5d&hl=en&gl=US&ceid=US:en' },
  { name: 'Dezeen', category: 'Your industries', url: 'https://www.dezeen.com/feed/' },
  { name: "It's Nice That", category: 'Your industries', url: 'https://www.itsnicethat.com/feed' },
  { name: 'The Verge', category: 'Tech & AI', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', category: 'Tech & AI', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Rest of World', category: 'Tech & AI', url: 'https://restofworld.org/feed/latest/' },
  { name: 'MIT Tech Review', category: 'Tech & AI', url: 'https://www.technologyreview.com/feed/' },
  { name: 'Good News Network', category: 'Progress', url: 'https://www.goodnewsnetwork.org/feed/' },
  { name: 'Breakthroughs', category: 'Progress', url: 'https://news.google.com/rss/search?q=(scientific+breakthrough+OR+new+discovery+OR+clean+energy+OR+medical+advance)+when:5d&hl=en&gl=US&ceid=US:en' }
];

/* ---------- tiny built-in RSS/Atom parser (no libraries) ---------- */
function decodeEntities(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n));}
function clean(s){if(!s)return '';s=s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ');return decodeEntities(s).replace(/\s+/g,' ').trim();}
function firstTag(b,names){for(const n of names){const m=b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`,'i'));if(m)return m[1];}return '';}
function getLink(b){let m=b.match(/<link>([\s\S]*?)<\/link>/i);if(m&&m[1].trim())return clean(m[1]);let best=null;for(const l of (b.match(/<link\b[^>]*>/gi)||[])){const href=(l.match(/href="([^"]+)"/i)||[])[1];if(!href)continue;const rel=(l.match(/rel="([^"]+)"/i)||[])[1];if(!rel||rel==='alternate'){best=href;break;}if(!best)best=href;}return best?decodeEntities(best):'';}
function parseItems(xml){
  const isAtom=/<entry[\s>]/i.test(xml);const tag=isAtom?'entry':'item';
  const parts=xml.split(new RegExp(`<${tag}(?:\\s[^>]*)?>`,'i')).slice(1);const out=[];
  for(const p of parts){const end=p.search(new RegExp(`<\\/${tag}>`,'i'));const b=end>=0?p.slice(0,end):p;
    const title=clean(firstTag(b,['title']));const url=getLink(b);
    const date=clean(firstTag(b,['pubDate','published','updated','dc:date','date']));
    const snippet=clean(firstTag(b,['description','summary','content:encoded','content'])).slice(0,300);
    if(title&&url)out.push({title,url,date:date||null,snippet});}
  return out;
}
async function fetchText(url,ms=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':'sweep-engine/1.0','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'}});
    if(!r.ok)throw new Error('HTTP '+r.status);return await r.text();}finally{clearTimeout(t);}}

/* ---------- helpers ---------- */
function cleanUrl(u=''){try{const url=new URL(u);['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(p=>url.searchParams.delete(p));return url.toString();}catch{return u;}}
function hoursAgo(iso){if(!iso)return '';const d=new Date(iso);if(isNaN(d))return '';const h=Math.round((Date.now()-d.getTime())/3600000);if(h<1)return 'now';if(h<24)return h+'h';return Math.round(h/24)+'d';}
function normTitle(t=''){return t.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();}

async function main(){
  /* 1. FETCH */
  let raw=[];
  for(const f of SOURCES){
    try{const xml=await fetchText(f.url);const items=parseItems(xml).slice(0,12);
      for(const it of items){const link=cleanUrl(it.url);if(!link)continue;
        raw.push({title:it.title,url:link,source:f.name,category:f.category,date:it.date,snippet:it.snippet});}
      console.log(`  ok  ${f.name} (${items.length})`);
    }catch(e){console.log(`  --  ${f.name}: ${e.message}`);}
  }
  /* 2. CLEAN & DEDUPE */
  const su=new Set(),st=new Set();let items=[];
  for(const it of raw){if(!it.title||it.title.length<12)continue;if(su.has(it.url))continue;const nt=normTitle(it.title);if(st.has(nt))continue;su.add(it.url);st.add(nt);items.push(it);}
  items.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const top=items.slice(0,CONFIG.maxItems);
  console.log(`\n${items.length} unique items; enriching top ${top.length}`);
  /* 3. ECONOMY (World Bank, keyless) */
  async function wb(code,ind){try{const r=await fetch(`https://api.worldbank.org/v2/country/${code}/indicator/${ind}?format=json&mrnev=1`);const j=await r.json();const row=j?.[1]?.[0];return row&&row.value!=null?{value:row.value,year:row.date}:null;}catch{return null;}}
  const econ=[];
  for(const loc of CONFIG.economy){try{const gdp=await wb(loc.code,'NY.GDP.MKTP.KD.ZG');const inf=await wb(loc.code,'FP.CPI.TOTL.ZG');const m=[];
    if(gdp)m.push({l:`GDP growth (${gdp.year})`,v:gdp.value.toFixed(1)+'%',chg:'',dir:gdp.value>=0?'up':'down'});
    if(inf)m.push({l:`Inflation (${inf.year})`,v:inf.value.toFixed(1)+'%',chg:'',dir:''});
    if(m.length)econ.push({scope:loc.scope,flag:loc.flag,metrics:m});}catch(e){console.log('econ skip',loc.scope);}}
  /* 4. ENRICH (Claude, optional) */
  function fallback(){
    const feed=top.map((it,i)=>({id:'s'+i,category:it.category,mustRead:i<CONFIG.mustReadCount,headline:it.title,source:it.source,time:hoursAgo(it.date),peek:it.snippet||'',summary:it.snippet?[it.snippet]:[],why:'',simple:'',spectrum:null,sources:[{name:it.source,url:it.url,lean:'center'}]}));
    const byCat={};top.forEach(it=>{(byCat[it.category]||=[]).push(it);});
    const clusters=Object.entries(byCat).slice(0,4).map(([cat,arr])=>({title:cat,bullets:arr.slice(0,3).map(x=>x.title),why:'',highlights:[],sources:arr.slice(0,3).map(x=>({name:x.source,url:x.url}))}));
    return {feed,brief:{clusters},signals:[],progress:[]};
  }
  async function enrich(){
    if(!API_KEY){console.log('No ANTHROPIC_API_KEY — clean headlines only.');return fallback();}
    if(!top.length)return fallback();
    try{
      const list=top.map((it,i)=>`[${i}] (${it.category}) ${it.title} — ${it.source}${it.snippet?' :: '+it.snippet:''}`).join('\n');
      const prompt=`You are the editor of a personal morning intelligence brief for ${CONFIG.greetingName}, whose interests are: ${CONFIG.interests.join('; ')}.\n\nCurate today's cleaned items into JSON. Accurate, neutral, concise; never invent facts beyond the snippets.\n\nITEMS:\n${list}\n\nReturn ONLY valid JSON (no markdown) shaped exactly:\n{"feed":[{"id":"s0","category":"<item category>","mustRead":true,"headline":"<headline>","source":"<source>","time":"","peek":"<1 sentence>","summary":["<3 short points>"],"why":"<1-2 sentences why it matters to ${CONFIG.greetingName}>","simple":"<explain like I'm 5, 1 sentence>","spectrum":{"left":0,"center":0,"right":0},"sources":[{"name":"<source>","url":"","lean":"center"}]}],"brief":{"clusters":[{"title":"<theme>","bullets":["<3-4 lines>"],"why":"<1 sentence>","highlights":[0],"sources":[{"name":"<source>","url":""}]}]},"signals":[{"text":"<1 line>","tag":"<tag>","dir":"up","url":""}],"progress":[{"tag":"Opportunity","title":"<short>","body":"<1 sentence>","url":""}]}\n\nUse the index order of ITEMS for "feed". Mark ${CONFIG.mustReadCount} as mustRead. 3-4 clusters, 3 signals, 3 progress. spectrum ~sums to 100.`;
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:MODEL,max_tokens:6000,messages:[{role:'user',content:prompt}]})});
      if(!r.ok){console.log('Claude call failed:',r.status,(await r.text()).slice(0,300));return fallback();}
      const j=await r.json();let text=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
      text=text.replace(/^```(json)?/i,'').replace(/```$/,'').trim();
      const parsed=JSON.parse(text);
      parsed.feed=(parsed.feed||[]).map((f,i)=>{const s=top[i]||{};return {...f,time:hoursAgo(s.date),sources:(f.sources&&f.sources.length&&f.sources[0].url)?f.sources:[{name:s.source,url:s.url,lean:'center'}]};});
      return parsed;
    }catch(e){console.log('Enrich error, fallback:',e.message);return fallback();}
  }
  const enriched=await enrich();
  /* 5. WRITE */
  const out={updatedAt:new Date().toISOString(),feed:enriched.feed||[],
    brief:{date:new Date().toLocaleDateString('en-GB',{weekday:'long',month:'long',day:'numeric'}),greeting:`Good morning, ${CONFIG.greetingName}`,clusters:enriched.brief?.clusters||[]},
    monitor:{economy:econ,signals:enriched.signals||[],progress:enriched.progress||[]},learn:CONFIG.learn};
  await writeFile('feed.json',JSON.stringify(out,null,2));
  console.log(`\nWrote feed.json — ${out.feed.length} stories, ${out.brief.clusters.length} clusters, ${econ.length} economies.`);
}
main().catch(async(e)=>{console.error('Sweep error (publishing empty feed so the job still succeeds):',e.message);
  try{await writeFile('feed.json',JSON.stringify({updatedAt:new Date().toISOString(),feed:[],brief:{date:new Date().toDateString(),greeting:'Good morning',clusters:[]},monitor:{economy:[],signals:[],progress:[]},learn:[]},null,2));}catch{}
  process.exit(0);});
