/* ============================================================
   THE SWEEP — ENGINE v2 · seven layers · zero dependencies
   money | power | operator | frontier | ground | primary | thought
   RSS bank + GDELT + ReliefWeb + Polymarket + World Bank + live markets
   Operator-driven: reads operator.json (published from the Sweep app).
   Never hard-fails: always writes a valid feed.json.
   ============================================================ */
import { writeFile, readFile } from 'node:fs/promises';

const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_SWEEP || '';
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';
let ENRICH = 'off (no key)';

const DEFAULT_OPERATOR = {
  name: 'Raheeda',
  industries: ['consumer goods & manufacturing','premium design & branding','furniture & design objects','private wealth & family business'],
  markets: ['Nigeria','West Africa','United Kingdom','Global'],
  companies: ['Eleganza Industries','Revelle'],
  keywords: ['naira','luxury market','manufacturing incentives','brand strategy'],
  people: []
};

const LAYER_LABEL = { money:'Money', power:'Power', operator:'Operator', frontier:'Frontier', ground:'Ground truth', primary:'Primary', thought:'Thought' };

/* ---------- THE SOURCE BANK ---------- */
const BANK = [
  /* MONEY — markets & macro, mainstream + Nigeria */
  {n:'Financial Times',l:'money',c:'Markets & macro',u:'https://www.ft.com/rss/home'},
  {n:'Bloomberg Markets',l:'money',c:'Markets & macro',u:'https://feeds.bloomberg.com/markets/news.rss'},
  {n:'Economist Finance',l:'money',c:'Markets & macro',u:'https://www.economist.com/finance-and-economics/rss.xml'},
  {n:'WSJ Markets',l:'money',c:'Markets & macro',u:'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain'},
  {n:'CNBC Markets',l:'money',c:'Markets & macro',u:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258'},
  {n:'BBC Business',l:'money',c:'Markets & macro',u:'https://feeds.bbci.co.uk/news/business/rss.xml'},
  {n:'Guardian Business',l:'money',c:'Markets & macro',u:'https://www.theguardian.com/uk/business/rss'},
  {n:'Nairametrics',l:'money',c:'Nigeria economy',u:'https://nairametrics.com/feed/'},
  {n:'BusinessDay NG',l:'money',c:'Nigeria economy',u:'https://businessday.ng/feed/'},
  /* POWER — geopolitics, security, statecraft */
  {n:'Foreign Affairs',l:'power',c:'Geopolitics',u:'https://www.foreignaffairs.com/rss.xml'},
  {n:'War on the Rocks',l:'power',c:'Geopolitics',u:'https://warontherocks.com/feed/'},
  {n:'Al Jazeera',l:'power',c:'World',u:'https://www.aljazeera.com/xml/rss/all.xml'},
  {n:'BBC Africa',l:'power',c:'Africa',u:'https://feeds.bbci.co.uk/news/world/africa/rss.xml'},
  {n:'BBC World',l:'power',c:'World',u:'https://feeds.bbci.co.uk/news/world/rss.xml'},
  {n:'Premium Times',l:'power',c:'Nigeria',u:'https://www.premiumtimesng.com/feed'},
  {n:'Guardian Nigeria',l:'power',c:'Nigeria',u:'https://guardian.ng/feed/'},
  /* OPERATOR — trade press for her worlds (plus dynamic queries below) */
  {n:'Business of Fashion',l:'operator',c:'Luxury & brand',u:'https://www.businessoffashion.com/arc/outboundfeeds/rss/?outputType=xml'},
  {n:'Vogue Business',l:'operator',c:'Luxury & brand',u:'https://www.voguebusiness.com/feed/rss'},
  {n:'Dezeen',l:'operator',c:'Design',u:'https://www.dezeen.com/feed/'},
  {n:"It's Nice That",l:'operator',c:'Design',u:'https://www.itsnicethat.com/feed'},
  {n:'Retail Dive',l:'operator',c:'Consumer & retail',u:'https://www.retaildive.com/feeds/news/'},
  {n:'Supply Chain Dive',l:'operator',c:'Supply chain',u:'https://www.supplychaindive.com/feeds/news/'},
  {n:'Manufacturing Dive',l:'operator',c:'Manufacturing',u:'https://www.manufacturingdive.com/feeds/news/'},
  {n:'TechCabal',l:'operator',c:'African business',u:'https://techcabal.com/feed/'},
  /* FRONTIER — science, breakthroughs, progress */
  {n:'MIT Tech Review',l:'frontier',c:'Technology',u:'https://www.technologyreview.com/feed/'},
  {n:'Nature',l:'frontier',c:'Science',u:'https://www.nature.com/nature.rss'},
  {n:'Quanta',l:'frontier',c:'Science',u:'https://www.quantamagazine.org/feed/'},
  {n:'Works in Progress',l:'frontier',c:'Progress studies',u:'https://worksinprogress.co/feed/'},
  {n:'Our World in Data',l:'frontier',c:'Data & progress',u:'https://ourworldindata.org/atom.xml'},
  {n:'Rest of World',l:'frontier',c:'Global tech',u:'https://restofworld.org/feed/latest/'},
  {n:'The Verge',l:'frontier',c:'Technology',u:'https://www.theverge.com/rss/index.xml'},
  {n:'Ars Technica',l:'frontier',c:'Technology',u:'https://feeds.arstechnica.com/arstechnica/index'},
  {n:'Good News Network',l:'frontier',c:'Progress',u:'https://www.goodnewsnetwork.org/feed/'},
  /* GROUND — community signal */
  {n:'Lobsters',l:'ground',c:'Community',u:'https://lobste.rs/rss'},
  {n:'r/Nigeria',l:'ground',c:'Community',u:'https://www.reddit.com/r/Nigeria/top/.rss?t=week'},
  {n:'r/Entrepreneur',l:'ground',c:'Community',u:'https://www.reddit.com/r/Entrepreneur/top/.rss?t=week'},
  /* PRIMARY — the signal before it becomes news */
  {n:'SEC 8-K filings',l:'primary',c:'Filings',u:'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&count=10&output=atom'},
  /* THOUGHT — the sharpest writers */
  {n:'Marginal Revolution',l:'thought',c:'Thinkers',u:'https://marginalrevolution.com/feed'},
  {n:'Stratechery',l:'thought',c:'Thinkers',u:'https://stratechery.com/feed/'},
  {n:'Farnam Street',l:'thought',c:'Thinkers',u:'https://fs.blog/feed/'},
  {n:'Noahpinion',l:'thought',c:'Thinkers',u:'https://www.noahpinion.blog/feed'},
  {n:'The Marginalian',l:'thought',c:'Thinkers',u:'https://www.themarginalian.org/feed/'},
];

/* ---------- tiny RSS/Atom parser ---------- */
function decodeEntities(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n));}
function clean(s){if(!s)return '';s=s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1');s=s.replace(/<[^>]+>/g,' ');s=decodeEntities(s);s=s.replace(/<[^>]+>/g,' ');s=decodeEntities(s);return s.replace(/\s+/g,' ').trim();}
function firstTag(b,names){for(const n of names){const m=b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`,'i'));if(m)return m[1];}return '';}
function getLink(b){let m=b.match(/<link>([\s\S]*?)<\/link>/i);if(m&&m[1].trim())return clean(m[1]);let best=null;for(const l of (b.match(/<link\b[^>]*>/gi)||[])){const href=(l.match(/href="([^"]+)"/i)||[])[1];if(!href)continue;const rel=(l.match(/rel="([^"]+)"/i)||[])[1];if(!rel||rel==='alternate'){best=href;break;}if(!best)best=href;}return best?decodeEntities(best):'';}
function parseItems(xml){const isAtom=/<entry[\s>]/i.test(xml);const tag=isAtom?'entry':'item';
  const parts=xml.split(new RegExp(`<${tag}(?:\\s[^>]*)?>`,'i')).slice(1);const out=[];
  for(const p of parts){const end=p.search(new RegExp(`<\\/${tag}>`,'i'));const b=end>=0?p.slice(0,end):p;
    const title=clean(firstTag(b,['title']));const url=getLink(b);
    const date=clean(firstTag(b,['pubDate','published','updated','dc:date','date']));
    const snippet=clean(firstTag(b,['description','summary','content:encoded','content'])).slice(0,280);
    if(title&&url)out.push({title,url,date:date||null,snippet});}
  return out;}
async function fetchX(url,ms=12000,asJson=false){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':'sweep-engine/2.0 (personal news digest)','Accept':asJson?'application/json':'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'}});
    if(!r.ok)throw new Error('HTTP '+r.status);return asJson?await r.json():await r.text();}finally{clearTimeout(t);}}

function cleanUrl(u=''){try{const url=new URL(u);['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(p=>url.searchParams.delete(p));return url.toString();}catch{return u;}}
function hoursAgo(iso){if(!iso)return '';const d=new Date(iso);if(isNaN(d))return '';const h=Math.round((Date.now()-d.getTime())/3600000);if(h<1)return 'now';if(h<24)return h+'h';return Math.round(h/24)+'d';}
function normTitle(t=''){return t.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();}
function repairJson(s){s=s.trim();let inStr=false,esc=false;const stack=[];
  for(let i=0;i<s.length;i++){const c=s[i];
    if(inStr){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')inStr=false;continue;}
    if(c==='"'){inStr=true;continue;}
    if(c==='{'||c==='[')stack.push(c);else if(c==='}'||c===']')stack.pop();}
  if(inStr){const q=s.lastIndexOf('"');if(q>0)s=s.slice(0,q);}
  s=s.replace(/[,\s]+$/,'');s=s.replace(/,\s*"[^"]*"\s*:?\s*$/,'');s=s.replace(/\{\s*"[^"]*"\s*:?\s*$/,'{');s=s.replace(/:\s*$/,'');s=s.replace(/[,\s]+$/,'');
  let close='';for(let i=stack.length-1;i>=0;i--)close+=stack[i]==='{'?'}':']';
  return s+close;}
async function claude(prompt,max=6000){
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:MODEL,max_tokens:max,messages:[{role:'user',content:prompt}]})});
  if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,180));
  const j=await r.json();let text=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
  const brace=text.match(/\{[\s\S]*\}/);if(!brace)throw new Error('no JSON in reply');
  try{return JSON.parse(brace[0]);}catch(e){return JSON.parse(repairJson(brace[0]));}}

async function main(){
  /* -------- operator profile (repo file overrides defaults) -------- */
  let OP=DEFAULT_OPERATOR;
  try{OP=Object.assign({},DEFAULT_OPERATOR,JSON.parse(await readFile('operator.json','utf8')));console.log('operator.json loaded');}catch(e){console.log('using default operator profile');}
  const gn=q=>`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;
  const dynamic=[];
  const mkt=(OP.markets&&OP.markets[0])||'Global';
  (OP.industries||[]).slice(0,4).forEach(i=>dynamic.push({n:'News · '+i,l:'operator',c:'Your focus',u:gn(`${i} ${mkt==='Global'?'':mkt} when:5d`)}));
  (OP.companies||[]).slice(0,4).forEach(cm=>dynamic.push({n:'Watch · '+cm,l:'operator',c:'Watchlist',u:gn(`"${cm}" when:7d`)}));
  (OP.keywords||[]).slice(0,4).forEach(k=>dynamic.push({n:'Theme · '+k,l:'operator',c:'Your focus',u:gn(`${k} when:3d`)}));
  (OP.people||[]).slice(0,3).forEach(p=>dynamic.push({n:'Person · '+p,l:'operator',c:'Watchlist',u:gn(`"${p}" when:7d`)}));

  /* -------- 1. FETCH: RSS bank + dynamic -------- */
  let raw=[];let okFeeds=0;
  for(const f of [...BANK,...dynamic]){
    try{const xml=await fetchX(f.u);const items=parseItems(xml).slice(0,7);okFeeds++;
      for(const it of items){const link=cleanUrl(it.url);if(!link)continue;
        raw.push({title:it.title,url:link,source:f.n.replace(/^(News|Watch|Theme|Person) · /,''),layer:f.l,category:f.c,date:it.date,snippet:it.snippet});}
      console.log(`  ok  ${f.n} (${items.length})`);
    }catch(e){console.log(`  --  ${f.n}: ${e.message}`);}
  }

  /* -------- 1b. GDELT (worldmonitor's backbone) -------- */
  const gq=[
    {q:`(${(OP.markets||['Nigeria']).slice(0,2).join(' OR ')}) (conflict OR security OR sanctions OR election OR "trade policy" OR coup)`,c:'Geopolitics · your markets'},
    {q:`("United States" OR China OR "European Union" OR Russia) (sanctions OR tariffs OR escalation OR treaty)`,c:'Geopolitics · great powers'}];
  for(const g of gq){
    try{const j=await fetchX(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(g.q)}&mode=ArtList&maxrecords=10&timespan=3d&sort=hybridrel&format=json`,15000,true);
      for(const a of (j.articles||[])){if(!a.title)continue;
        const d=a.seendate?`${a.seendate.slice(0,4)}-${a.seendate.slice(4,6)}-${a.seendate.slice(6,8)}T${a.seendate.slice(9,11)}:${a.seendate.slice(11,13)}:00Z`:null;
        raw.push({title:clean(a.title),url:cleanUrl(a.url),source:a.domain||'GDELT',layer:'power',category:g.c,date:d,snippet:`Surfaced by GDELT global events monitor${a.sourcecountry?' · source: '+a.sourcecountry:''}`});}
      console.log(`  ok  GDELT ${g.c}`);
    }catch(e){console.log(`  --  GDELT: ${e.message}`);}
  }
  /* -------- 1c. ReliefWeb (crisis watch) -------- */
  try{const j=await fetchX(`https://api.reliefweb.int/v1/reports?appname=the-sweep&limit=6&sort[]=date:desc&query[value]=${encodeURIComponent((OP.markets||['Nigeria']).slice(0,2).join(' OR '))}&fields[include][]=title&fields[include][]=url&fields[include][]=date.created`,15000,true);
    for(const r of (j.data||[])){const f=r.fields||{};if(!f.title)continue;
      raw.push({title:clean(f.title),url:f.url||('https://reliefweb.int/node/'+r.id),source:'ReliefWeb',layer:'power',category:'Crisis watch',date:f.date&&f.date.created,snippet:'Humanitarian & crisis reporting'});}
    console.log('  ok  ReliefWeb');
  }catch(e){console.log('  --  ReliefWeb: '+e.message);}
  /* -------- 1d. Hacker News (operator-tuned) -------- */
  const hq=[...(OP.keywords||[]).slice(0,2),...(OP.industries||[]).slice(0,2)];
  for(const q of hq){
    try{const j=await fetchX(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=5`,12000,true);
      for(const h of (j.hits||[])){if(!h.title)continue;
        raw.push({title:h.title.trim(),url:cleanUrl(h.url||`https://news.ycombinator.com/item?id=${h.objectID}`),source:'Hacker News',layer:'ground',category:'Community',date:h.created_at,snippet:`${h.points||0} points · ${h.num_comments||0} comments — community discussion`});}
      console.log(`  ok  HN "${q}"`);
    }catch(e){console.log(`  --  HN: ${e.message}`);}
  }
  /* -------- 1e. Polymarket (real-money odds) -------- */
  try{const j=await fetchX('https://gamma-api.polymarket.com/events?limit=6&active=true&closed=false&order=volume24hr&ascending=false',12000,true);
    for(const ev of (Array.isArray(j)?j:[])){if(!ev.title)continue;
      raw.push({title:'Odds: '+ev.title,url:'https://polymarket.com/event/'+(ev.slug||''),source:'Polymarket',layer:'ground',category:'Prediction markets',date:new Date().toISOString(),snippet:`$${Math.round((+ev.volume24hr||0)).toLocaleString()} traded in 24h — what money believes`});}
    console.log('  ok  Polymarket');
  }catch(e){console.log('  --  Polymarket: '+e.message);}

  /* -------- 2. CLEAN, DEDUPE, SELECT (per-layer quotas) -------- */
  const su=new Set(),st=new Set();let items=[];
  for(const it of raw){if(!it.title||it.title.length<12)continue;if(su.has(it.url))continue;const nt=normTitle(it.title);if(st.has(nt))continue;su.add(it.url);st.add(nt);items.push(it);}
  items.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const quota={money:5,power:6,operator:7,frontier:4,ground:4,primary:2,thought:3};
  const top=[];for(const L of Object.keys(quota)){top.push(...items.filter(x=>x.layer===L).slice(0,quota[L]));}
  console.log(`\n${items.length} unique items from ${okFeeds} live feeds; selected ${top.length}`);

  /* -------- watch hits (deterministic) -------- */
  const watchTerms=[...(OP.companies||[]),...(OP.people||[]),...(OP.keywords||[])].filter(Boolean);
  const hits=t=>{const s=(t.title+' '+t.snippet).toLowerCase();return watchTerms.filter(w=>s.includes(w.toLowerCase()));};

  /* -------- 3. MONITOR DATA (deterministic, keyless) -------- */
  const monitor={markets:[],economy:[],events:[],signals:[],progress:[]};
  try{const j=await fetchX('https://open.er-api.com/v6/latest/USD',12000,true);const R=j.rates||{};
    if(R.NGN)monitor.markets.push({l:'USD / NGN',v:Math.round(R.NGN).toLocaleString(),chg:'',dir:''});
    if(R.GBP)monitor.markets.push({l:'GBP / USD',v:(1/R.GBP).toFixed(3),chg:'',dir:''});
    if(R.EUR)monitor.markets.push({l:'EUR / USD',v:(1/R.EUR).toFixed(3),chg:'',dir:''});
    console.log('  ok  FX');}catch(e){console.log('  --  FX: '+e.message);}
  const stooq=[{s:'^spx',l:'S&P 500'},{s:'^ukx',l:'FTSE 100'},{s:'xauusd',l:'Gold $'},{s:'cl.f',l:'WTI oil $'}];
  for(const q of stooq){try{const csv=await fetchX(`https://stooq.com/q/l/?s=${q.s}&f=sd2t2ohlcv&h&e=csv`,10000);
      const row=csv.trim().split('\n')[1];if(!row)continue;const close=row.split(',')[6];
      if(close&&close!=='N/D')monitor.markets.push({l:q.l,v:(+close).toLocaleString(undefined,{maximumFractionDigits:2}),chg:'',dir:''});
    }catch(e){console.log('  --  stooq '+q.s);}}
  async function wb(code,ind){try{const j=await fetchX(`https://api.worldbank.org/v2/country/${code}/indicator/${ind}?format=json&mrnev=1`,12000,true);const row=j?.[1]?.[0];return row&&row.value!=null?{value:row.value,year:row.date}:null;}catch{return null;}}
  const ECON=[{scope:'Nigeria',code:'NGA',flag:'\uD83C\uDDF3\uD83C\uDDEC'},{scope:'Global',code:'WLD',flag:'\uD83C\uDF0D'}];
  for(const loc of ECON){const gdp=await wb(loc.code,'NY.GDP.MKTP.KD.ZG');const inf=await wb(loc.code,'FP.CPI.TOTL.ZG');const m=[];
    if(gdp)m.push({l:`GDP growth (${gdp.year})`,v:gdp.value.toFixed(1)+'%',chg:'',dir:gdp.value>=0?'up':'down'});
    if(inf)m.push({l:`Inflation (${inf.year})`,v:inf.value.toFixed(1)+'%',chg:'',dir:''});
    if(m.length)monitor.economy.push({scope:loc.scope,flag:loc.flag,metrics:m});}
  monitor.events=top.filter(x=>x.layer==='power').slice(0,8).map(x=>({title:x.title,url:x.url,tag:x.category,region:''}));

  /* -------- 4. ENRICH (two focused Claude calls) -------- */
  const listing=top.map((it,i)=>`[${i}] {${it.layer}} (${it.category}) ${it.title} — ${it.source}${it.snippet?' :: '+it.snippet.slice(0,160):''}`).join('\n');
  const profile=`OPERATOR PROFILE — name: ${OP.name}; industries: ${(OP.industries||[]).join(', ')}; markets: ${(OP.markets||[]).join(', ')}; companies watched: ${(OP.companies||[]).join(', ')||'none'}; keywords: ${(OP.keywords||[]).join(', ')||'none'}; people watched: ${(OP.people||[]).join(', ')||'none'}.`;
  function fb(){
    const feed=top.map((it,i)=>({id:'s'+i,layer:it.layer,layerLabel:LAYER_LABEL[it.layer],category:it.category,mustRead:i<3,headline:it.title,source:it.source,time:hoursAgo(it.date),peek:it.snippet||'',summary:it.snippet?[it.snippet]:[],why:'',simple:'',spectrum:null,sources:[{name:it.source,url:it.url,lean:'center'}],watch:hits(it)}));
    const byL={};top.forEach(it=>{(byL[it.layer]||=[]).push(it);});
    const clusters=Object.entries(byL).slice(0,4).map(([L,arr])=>({title:LAYER_LABEL[L],bullets:arr.slice(0,3).map(x=>x.title),why:'',highlights:[],sources:arr.slice(0,3).map(x=>({name:x.source,url:x.url}))}));
    return {feed,brief:{clusters,analysis:null},signals:[],progress:[]};}
  let out;
  if(!API_KEY){out=fb();}
  else{
    let feedPart=null,briefPart=null;const errs=[];
    try{const a=await claude(`You are the intelligence editor for a daily brief. ${profile}\n\nITEMS (index {layer} (category) headline — source :: snippet):\n${listing}\n\nFor EVERY index return compact JSON ONLY:\n{"items":[{"i":0,"peek":"<1 tight sentence>","summary":["<2-3 short key points>"],"why":"<1-2 sentences why it matters to this operator specifically>","simple":"<1 plain sentence>","spectrum":{"left":0,"center":0,"right":0},"mustRead":false}]}\nMark exactly 4 items mustRead — the highest-stakes across ALL layers. spectrum ~sums to 100 reflecting how left/center/right outlets would cover it.`,7000);
      feedPart=a.items||[];}catch(e){errs.push('feed:'+e.message);}
    try{const b=await claude(`You are chief analyst writing the morning synthesis for a builder-CEO. ${profile}\n\nITEMS:\n${listing}\n\nReturn JSON ONLY:\n{"analysis":{"overview":"<4-5 sentence executive read connecting today's biggest forces to this operator's position — sophisticated, direct, zero fluff>","themes":[{"name":"<theme>","weight":7,"dir":"up"}],"risks":["<2-3 concrete risks>"],"opportunities":["<2-3 concrete opportunities>"]},"clusters":[{"title":"<theme>","bullets":["<3-4 lines>"],"why":"<1 sentence>","highlights":[0],"sources":[{"name":"<source>","url":""}]}],"signals":[{"text":"<1 line>","tag":"<tag>","dir":"up","url":""}],"progress":[{"tag":"Opportunity","title":"<short>","body":"<1 sentence>","url":""}]}\n5-7 themes weighted 1-10 with dir up/down/flat. 3-5 clusters. 4 signals. 3 progress.`,4000);
      briefPart=b;}catch(e){errs.push('brief:'+e.message);}
    const base=fb();
    if(feedPart){const map=new Map(feedPart.map(x=>[x.i,x]));
      base.feed=base.feed.map((f,i)=>{const e=map.get(i);return e?{...f,peek:e.peek||f.peek,summary:e.summary&&e.summary.length?e.summary:f.summary,why:e.why||'',simple:e.simple||'',spectrum:e.spectrum||null,mustRead:!!e.mustRead}:f;});
      if(!base.feed.some(f=>f.mustRead))base.feed.slice(0,4).forEach(f=>f.mustRead=true);}
    if(briefPart){base.brief={clusters:briefPart.clusters||base.brief.clusters,analysis:briefPart.analysis||null};
      base.signals=briefPart.signals||[];base.progress=briefPart.progress||[];}
    ENRICH=(feedPart&&briefPart)?'on':(feedPart||briefPart)?('partial ('+errs.join('; ')+')'):('failed: '+errs.join('; '));
    out=base;}
  monitor.signals=out.signals||[];monitor.progress=out.progress||[];

  /* -------- 5. ANALYTICS (deterministic) -------- */
  const byLayer={};out.feed.forEach(f=>{byLayer[f.layerLabel||LAYER_LABEL[f.layer]]=(byLayer[f.layerLabel||LAYER_LABEL[f.layer]]||0)+1;});
  let sp={left:0,center:0,right:0},spn=0;out.feed.forEach(f=>{if(f.spectrum){sp.left+=f.spectrum.left;sp.center+=f.spectrum.center;sp.right+=f.spectrum.right;spn++;}});
  if(spn){sp={left:Math.round(sp.left/spn),center:Math.round(sp.center/spn),right:Math.round(sp.right/spn)};}else sp=null;

  /* -------- 6. WRITE -------- */
  const doc={updatedAt:new Date().toISOString(),_enrichment:ENRICH,
    operator:OP,
    feed:out.feed,
    brief:{date:new Date().toLocaleDateString('en-GB',{weekday:'long',month:'long',day:'numeric'}),greeting:`Good morning, ${OP.name}`,clusters:out.brief.clusters,analysis:out.brief.analysis},
    monitor,
    analytics:{byLayer,spectrum:sp,liveFeeds:okFeeds,items:out.feed.length},
    learn:[
      {tag:'Strategy',title:'Concentrate your forces',body:"Greene's Law 23: spreading thin dilutes power. Pick the one prospect, one venture, one deliverable that moves the most, and pour in until it's inevitable."},
      {tag:'Leverage',title:'Play long-term games with long-term people',body:"Naval's rule: compounding trust and equity beats one-off wins. Choose partners and clients you'd want to be building with in ten years."},
      {tag:'Negotiation',title:'Anchor, then go quiet',body:'State your number clearly and stop talking. Silence transfers pressure to the other side and protects your position.'},
      {tag:'Craft',title:'Ship the finished thing',body:'A deployable draft beats a perfect plan. Reduce the loop between idea and artifact — momentum is a moat.'}]};
  await writeFile('feed.json',JSON.stringify(doc,null,2));
  console.log(`\nWrote feed.json — enrichment ${ENRICH}, ${doc.feed.length} stories across ${Object.keys(byLayer).length} layers, ${monitor.markets.length} market ticks, ${monitor.economy.length} economies.`);
}
main().catch(async(e)=>{console.error('Sweep error (publishing empty feed so the job still succeeds):',e.message);
  try{await writeFile('feed.json',JSON.stringify({updatedAt:new Date().toISOString(),_enrichment:'failed: '+e.message,feed:[],brief:{date:new Date().toDateString(),greeting:'Good morning',clusters:[],analysis:null},monitor:{markets:[],economy:[],events:[],signals:[],progress:[]},analytics:{},learn:[]},null,2));}catch{}
  process.exit(0);});
