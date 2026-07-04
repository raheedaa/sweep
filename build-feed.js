/* ============================================================
   THE SWEEP — ENGINE v2.1 · worlds edition · zero dependencies
   Seven layers + WORLDS: every tab is its own comprehensive sweep,
   with its own must-reads and a deep everything-else.
   Sources: ~45-feed bank + GDELT + ReliefWeb + Polymarket + HN
   + World Bank + live markets + operator-generated queries.
   Never hard-fails: always writes a valid feed.json.
   ============================================================ */
import { writeFile, readFile } from 'node:fs/promises';

const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_SWEEP || '';
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';
const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL || MODEL;
let ENRICH = 'off (no key)';

const DEFAULT_OPERATOR = {
  name: 'Raheeda',
  industries: ['consumer goods & manufacturing','premium design & branding','furniture & design objects','private wealth & family business'],
  markets: ['Nigeria','West Africa','United Kingdom','Global'],
  companies: ['Eleganza Industries','Revelle'],
  keywords: ['naira','luxury market','manufacturing incentives','brand strategy'],
  people: [],
  worlds: [],           /* custom tabs added from the Sweep app */
  selfEntities: [],      /* you & yours — names to monitor */
  competitorsCurrent: [],
  competitorsAspirational: []
};
const LAYER_LABEL = { money:'Money', power:'Power', operator:'Operator', frontier:'Frontier', ground:'Ground truth', primary:'Primary', thought:'Thought' };

const BANK = [
  {n:'Financial Times',l:'money',c:'Markets & macro',u:'https://www.ft.com/rss/home'},
  {n:'Bloomberg Markets',l:'money',c:'Markets & macro',u:'https://feeds.bloomberg.com/markets/news.rss'},
  {n:'Economist Finance',l:'money',c:'Markets & macro',u:'https://www.economist.com/finance-and-economics/rss.xml'},
  {n:'WSJ Markets',l:'money',c:'Markets & macro',u:'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain'},
  {n:'CNBC Markets',l:'money',c:'Markets & macro',u:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258'},
  {n:'BBC Business',l:'money',c:'Markets & macro',u:'https://feeds.bbci.co.uk/news/business/rss.xml'},
  {n:'Guardian Business',l:'money',c:'Markets & macro',u:'https://www.theguardian.com/uk/business/rss'},
  {n:'Nairametrics',l:'money',c:'Nigeria economy',u:'https://nairametrics.com/feed/'},
  {n:'BusinessDay NG',l:'money',c:'Nigeria economy',u:'https://businessday.ng/feed/'},
  {n:'Foreign Affairs',l:'power',c:'Geopolitics',u:'https://www.foreignaffairs.com/rss.xml'},
  {n:'War on the Rocks',l:'power',c:'Geopolitics',u:'https://warontherocks.com/feed/'},
  {n:'Al Jazeera',l:'power',c:'World',u:'https://www.aljazeera.com/xml/rss/all.xml'},
  {n:'BBC Africa',l:'power',c:'Africa',u:'https://feeds.bbci.co.uk/news/world/africa/rss.xml'},
  {n:'BBC World',l:'power',c:'World',u:'https://feeds.bbci.co.uk/news/world/rss.xml'},
  {n:'Premium Times',l:'power',c:'Nigeria',u:'https://www.premiumtimesng.com/feed'},
  {n:'Guardian Nigeria',l:'power',c:'Nigeria',u:'https://guardian.ng/feed/'},
  {n:'Business of Fashion',l:'operator',c:'Luxury & brand',u:'https://www.businessoffashion.com/arc/outboundfeeds/rss/?outputType=xml'},
  {n:'Vogue Business',l:'operator',c:'Luxury & brand',u:'https://www.voguebusiness.com/feed/rss'},
  {n:'Dezeen',l:'operator',c:'Design',u:'https://www.dezeen.com/feed/'},
  {n:"It's Nice That",l:'operator',c:'Design',u:'https://www.itsnicethat.com/feed'},
  {n:'Retail Dive',l:'operator',c:'Consumer & retail',u:'https://www.retaildive.com/feeds/news/'},
  {n:'Supply Chain Dive',l:'operator',c:'Supply chain',u:'https://www.supplychaindive.com/feeds/news/'},
  {n:'Manufacturing Dive',l:'operator',c:'Manufacturing',u:'https://www.manufacturingdive.com/feeds/news/'},
  {n:'TechCabal',l:'operator',c:'African business',u:'https://techcabal.com/feed/'},
  {n:'MIT Tech Review',l:'frontier',c:'Technology',u:'https://www.technologyreview.com/feed/'},
  {n:'Nature',l:'frontier',c:'Science',u:'https://www.nature.com/nature.rss'},
  {n:'Quanta',l:'frontier',c:'Science',u:'https://www.quantamagazine.org/feed/'},
  {n:'Works in Progress',l:'frontier',c:'Progress studies',u:'https://worksinprogress.co/feed/'},
  {n:'Our World in Data',l:'frontier',c:'Data & progress',u:'https://ourworldindata.org/atom.xml'},
  {n:'Rest of World',l:'frontier',c:'Global tech',u:'https://restofworld.org/feed/latest/'},
  {n:'The Verge',l:'frontier',c:'Technology',u:'https://www.theverge.com/rss/index.xml'},
  {n:'Ars Technica',l:'frontier',c:'Technology',u:'https://feeds.arstechnica.com/arstechnica/index'},
  {n:'Good News Network',l:'frontier',c:'Progress',u:'https://www.goodnewsnetwork.org/feed/'},
  {n:'Lobsters',l:'ground',c:'Community',u:'https://lobste.rs/rss'},
  {n:'r/Nigeria',l:'ground',c:'Community',u:'https://www.reddit.com/r/Nigeria/top/.rss?t=week'},
  {n:'r/Entrepreneur',l:'ground',c:'Community',u:'https://www.reddit.com/r/Entrepreneur/top/.rss?t=week'},
  {n:'SEC 8-K filings',l:'primary',c:'Filings',u:'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&count=10&output=atom'},
  {n:'Marginal Revolution',l:'thought',c:'Thinkers',u:'https://marginalrevolution.com/feed'},
  {n:'Stratechery',l:'thought',c:'Thinkers',u:'https://stratechery.com/feed/'},
  {n:'Farnam Street',l:'thought',c:'Thinkers',u:'https://fs.blog/feed/'},
  {n:'Noahpinion',l:'thought',c:'Thinkers',u:'https://www.noahpinion.blog/feed'},
  {n:'The Marginalian',l:'thought',c:'Thinkers',u:'https://www.themarginalian.org/feed/'},
];

/* PROVERBIAL — the world's compressed wisdom, rotating daily */
const PROVERBS = [
  {t:'Òwe l\u2019ẹṣin ọ̀rọ̀ (Yoruba)',b:'“Proverbs are the horses of speech.” When words get lost, proverbs carry them — compressed argument that arrives faster than explanation.'},
  {t:'間 · ma (Japanese)',b:'The charged emptiness between things — the pause in speech, the space in a room. Not absence but structure. Design and negotiation both turn on it.'},
  {t:'Sankofa (Akan)',b:'“Go back and fetch it.” It is never wrong to return for what you forgot — progress that abandons its origins is not progress.'},
  {t:'Festina lente (Latin)',b:'“Hasten slowly.” Augustus’ motto: urgency in purpose, deliberation in execution. Speed without control is just noise.'},
  {t:'上善若水 (Laozi)',b:'“The highest good is like water” — it benefits all things without contending, and settles where others refuse to go. Power that doesn’t announce itself.'},
  {t:'Sannu ba ta hana zuwa (Hausa)',b:'“Going slowly does not prevent arriving.” Patience is not delay; it is a route.'},
  {t:'水滴石穿 (Chinese)',b:'“Dripping water pierces stone.” Not by force but by persistence — the compounding law, four characters long.'},
  {t:'الصبر مفتاح الفرج (Arabic)',b:'“Patience is the key to relief.” Sabr is not passive waiting but steadfastness under load — endurance with intention.'},
  {t:'اعقلها وتوكل (Arabic)',b:'“Tie your camel, then trust God.” Tawakkul is not the absence of effort — do everything in your power first, then release the outcome.'},
  {t:'七転び八起き (Japanese)',b:'“Fall seven times, rise eight.” Identity is not the falling; it is the count of the rising.'},
  {t:'Ubuntu (Zulu/Xhosa)',b:'“I am because we are.” Personhood as something conferred by community — the anti-thesis of the self-made myth, and truer.'},
  {t:'Nunchi (Korean)',b:'The art of reading a room instantly — sensing mood, hierarchy and the unsaid. In Korea it is considered a survival skill; everywhere it is an advantage.'},
  {t:'Sisu (Finnish)',b:'Resolve past the point where courage runs out. Not bravery in the moment but grim continuance across months.'},
  {t:'Saudade (Portuguese)',b:'Longing for something absent that may never return — a homesickness for places and futures you have not seen. Naming it makes it usable.'},
  {t:'L\u2019esprit de l\u2019escalier (French)',b:'“Staircase wit” — the perfect reply that arrives too late, on the stairs out. The cure is preparation, not quickness.'},
  {t:'Der mentsh trakht un got lakht (Yiddish)',b:'“Man plans and God laughs.” Hold the plan tightly and the outcome loosely.'},
  {t:'Haraka haraka haina baraka (Swahili)',b:'“Hurry, hurry has no blessing.” Distinguish urgency from haste; only one of them compounds.'},
  {t:'μηδὲν ἄγαν (Greek, Delphi)',b:'“Nothing in excess” — carved at Delphi beside “know thyself.” The two instructions are one instruction.'},
  {t:'Fingerspitzengefühl (German)',b:'“Fingertip feeling” — intuitive fluency in a complex situation, knowing without deliberating. Built only by reps.'},
  {t:'Onye aghala nwanne ya (Igbo)',b:'“Let no one leave their kin behind.” Wealth that abandons its people is counted as poverty.'},
  {t:'Vasudhaiva Kutumbakam (Sanskrit)',b:'“The world is one family.” The oldest argument for the widest circle of concern.'},
  {t:'Wabi-sabi (Japanese)',b:'Beauty in imperfection and impermanence — the cracked bowl honoured with gold. A standard of taste that machines cannot fake.'},
];

/* ---------- parser + helpers ---------- */
function decodeEntities(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n));}
function clean(s){if(!s)return '';s=s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1');s=s.replace(/<[^>]+>/g,' ');s=decodeEntities(s);s=s.replace(/<[^>]+>/g,' ');s=decodeEntities(s);return s.replace(/\s+/g,' ').trim();}
function firstTag(b,names){for(const n of names){const m=b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`,'i'));if(m)return m[1];}return '';}
function getLink(b){let m=b.match(/<link>([\s\S]*?)<\/link>/i);if(m&&m[1].trim())return clean(m[1]);let best=null;for(const l of (b.match(/<link\b[^>]*>/gi)||[])){const href=(l.match(/href="([^"]+)"/i)||[])[1];if(!href)continue;const rel=(l.match(/rel="([^"]+)"/i)||[])[1];if(!rel||rel==='alternate'){best=href;break;}if(!best)best=href;}return best?decodeEntities(best):'';}
function parseItems(xml){const isAtom=/<entry[\s>]/i.test(xml);const tag=isAtom?'entry':'item';
  const parts=xml.split(new RegExp(`<${tag}(?:\\s[^>]*)?>`,'i')).slice(1);const out=[];
  for(const p of parts){const end=p.search(new RegExp(`<\\/${tag}>`,'i'));const b=end>=0?p.slice(0,end):p;
    const title=clean(firstTag(b,['title']));const url=getLink(b);
    const date=clean(firstTag(b,['pubDate','published','updated','dc:date','date']));
    const snippet=clean(firstTag(b,['description','summary','content:encoded','content'])).slice(0,260);
    if(title&&url)out.push({title,url,date:date||null,snippet});}
  return out;}
async function fetchX(url,ms=12000,asJson=false){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'User-Agent':'sweep-engine/2.1 (personal news digest)','Accept':asJson?'application/json':'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'}});
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
async function claude(prompt,max,model){
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:model||MODEL,max_tokens:max||6000,messages:[{role:'user',content:prompt}]})});
  if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,160));
  const j=await r.json();let text=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
  const brace=text.match(/\{[\s\S]*\}/);if(!brace)throw new Error('no JSON in reply');
  try{return JSON.parse(brace[0]);}catch(e){return JSON.parse(repairJson(brace[0]));}}

async function main(){
  let OP=DEFAULT_OPERATOR;
  try{OP=Object.assign({},DEFAULT_OPERATOR,JSON.parse(await readFile('operator.json','utf8')));console.log('operator.json loaded');}catch(e){console.log('using default operator profile');}
  let PREV=null;try{PREV=JSON.parse(await readFile('feed.json','utf8'));}catch(e){}
  const gn=q=>`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

  /* WORLDS: geographic markets + user-created tabs — each becomes its own sweep */
  const hasSelf=((OP.selfEntities||[]).length+(OP.competitorsCurrent||[]).length+(OP.competitorsAspirational||[]).length)>0;
  const WORLDS=[...new Set([
    ...(hasSelf?['Self']:[]),
    ...(OP.markets||[]).filter(m=>m&&m.toLowerCase()!=='global'),
    ...(OP.worlds||[])
  ])].slice(0,12);

  const dynamic=[];
  const mkt=(OP.markets&&OP.markets[0])||'Global';
  (OP.industries||[]).slice(0,4).forEach(i=>dynamic.push({n:'News · '+i,l:'operator',c:'Your focus',u:gn(`${i} ${mkt==='Global'?'':mkt} when:5d`)}));
  (OP.companies||[]).slice(0,4).forEach(cm=>dynamic.push({n:'Watch · '+cm,l:'operator',c:'Watchlist',u:gn(`"${cm}" when:7d`)}));
  (OP.keywords||[]).slice(0,4).forEach(k=>dynamic.push({n:'Theme · '+k,l:'operator',c:'Your focus',u:gn(`${k} when:3d`)}));
  (OP.people||[]).slice(0,3).forEach(p=>dynamic.push({n:'Person · '+p,l:'operator',c:'Watchlist',u:gn(`"${p}" when:7d`)}));
  /* two deep queries per world so every tab has real volume */
  WORLDS.filter(w=>w!=='Self').forEach(w=>{
    dynamic.push({n:'World · '+w,l:'operator',c:w,u:gn(`"${w}" when:1d`),w});
    dynamic.push({n:'World+ · '+w,l:'operator',c:w,u:gn(`${w} (economy OR politics OR business OR culture OR technology) when:2d`),w});
  });
  (OP.selfEntities||[]).slice(0,5).forEach(e=>dynamic.push({n:'Self · '+e,l:'operator',c:'Self',u:gn(`"${e}" when:7d`),w:'Self',k:'self'}));
  (OP.competitorsCurrent||[]).slice(0,5).forEach(e=>dynamic.push({n:'Rival · '+e,l:'operator',c:'Competitors',u:gn(`"${e}" when:7d`),w:'Self',k:'comp-current'}));
  (OP.competitorsAspirational||[]).slice(0,5).forEach(e=>dynamic.push({n:'North · '+e,l:'operator',c:'Competitors',u:gn(`"${e}" when:7d`),w:'Self',k:'comp-asp'}));

  /* 1. FETCH */
  let raw=[];let okFeeds=0;
  for(const f of [...BANK,...dynamic]){
    try{const xml=await fetchX(f.u);const items=parseItems(xml).slice(0,10);okFeeds++;
      for(const it of items){const link=cleanUrl(it.url);if(!link)continue;
        raw.push({title:it.title,url:link,source:f.n.replace(/^(News|Watch|Theme|Person|World\+?|Self|Rival|North) · /,''),layer:f.l,category:f.c,date:it.date,snippet:it.snippet,w:f.w||null,k:f.k||null});}
      console.log(`  ok  ${f.n} (${items.length})`);
    }catch(e){console.log(`  --  ${f.n}: ${e.message}`);}
  }
  const gq=[
    {q:`(${(OP.markets||['Nigeria']).slice(0,2).join(' OR ')}) (conflict OR security OR sanctions OR election OR "trade policy" OR coup)`,c:'Geopolitics · your markets'},
    {q:`("United States" OR China OR "European Union" OR Russia) (sanctions OR tariffs OR escalation OR treaty)`,c:'Geopolitics · great powers'}];
  for(const g of gq){
    try{const j=await fetchX(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(g.q)}&mode=ArtList&maxrecords=12&timespan=3d&sort=hybridrel&format=json`,15000,true);
      for(const a of (j.articles||[])){if(!a.title)continue;
        const d=a.seendate?`${a.seendate.slice(0,4)}-${a.seendate.slice(4,6)}-${a.seendate.slice(6,8)}T${a.seendate.slice(9,11)}:${a.seendate.slice(11,13)}:00Z`:null;
        raw.push({title:clean(a.title),url:cleanUrl(a.url),source:a.domain||'GDELT',layer:'power',category:g.c,date:d,snippet:'Surfaced by GDELT global events monitor',w:null});}
      console.log(`  ok  GDELT ${g.c}`);
    }catch(e){console.log(`  --  GDELT: ${e.message}`);}
  }
  try{const j=await fetchX(`https://api.reliefweb.int/v1/reports?appname=the-sweep&limit=6&sort[]=date:desc&query[value]=${encodeURIComponent((OP.markets||['Nigeria']).slice(0,2).join(' OR '))}&fields[include][]=title&fields[include][]=url&fields[include][]=date.created`,15000,true);
    for(const r of (j.data||[])){const f=r.fields||{};if(!f.title)continue;
      raw.push({title:clean(f.title),url:f.url||('https://reliefweb.int/node/'+r.id),source:'ReliefWeb',layer:'power',category:'Crisis watch',date:f.date&&f.date.created,snippet:'Humanitarian & crisis reporting',w:null});}
    console.log('  ok  ReliefWeb');}catch(e){console.log('  --  ReliefWeb: '+e.message);}
  for(const q of [...(OP.keywords||[]).slice(0,2),...(OP.industries||[]).slice(0,2)]){
    try{const j=await fetchX(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=5`,12000,true);
      for(const h of (j.hits||[])){if(!h.title)continue;
        raw.push({title:h.title.trim(),url:cleanUrl(h.url||`https://news.ycombinator.com/item?id=${h.objectID}`),source:'Hacker News',layer:'ground',category:'Community',date:h.created_at,snippet:`${h.points||0} points · ${h.num_comments||0} comments`,w:null});}
      console.log(`  ok  HN "${q}"`);}catch(e){console.log(`  --  HN: ${e.message}`);}
  }
  try{const j=await fetchX('https://gamma-api.polymarket.com/events?limit=6&active=true&closed=false&order=volume24hr&ascending=false',12000,true);
    for(const ev of (Array.isArray(j)?j:[])){if(!ev.title)continue;
      raw.push({title:'Odds: '+ev.title,url:'https://polymarket.com/event/'+(ev.slug||''),source:'Polymarket',layer:'ground',category:'Prediction markets',date:new Date().toISOString(),snippet:`$${Math.round((+ev.volume24hr||0)).toLocaleString()} traded in 24h — what money believes`,w:null});}
    console.log('  ok  Polymarket');}catch(e){console.log('  --  Polymarket: '+e.message);}

  /* 2. CLEAN, DEDUPE, TAG WORLDS — keep the full corpus */
  const su=new Set(),st=new Set();let items=[];
  for(const it of raw){if(!it.title||it.title.length<12)continue;if(su.has(it.url))continue;const nt=normTitle(it.title);if(st.has(nt))continue;su.add(it.url);st.add(nt);items.push(it);}
  items.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  items=items.slice(0,220);
  const wmatch=(t,w)=>((t.title+' '+t.snippet).toLowerCase().includes(w.toLowerCase()));
  items.forEach(it=>{it.worlds=[...new Set([...(it.w?[it.w]:[]),...WORLDS.filter(w=>w!=='Self'&&wmatch(it,w))])];});
  const selfNames=(OP.selfEntities||[]);
  const comps=[...(OP.competitorsCurrent||[]).map(n=>({name:n,type:'current'})),...(OP.competitorsAspirational||[]).map(n=>({name:n,type:'aspirational'}))];
  items.forEach(it=>{
    if(!it.k){ if(selfNames.some(n=>wmatch(it,n)))it.k='self';
      else{const c=comps.find(c=>wmatch(it,c.name));if(c)it.k=c.type==='current'?'comp-current':'comp-asp';}}
    if(it.k&&!it.worlds.includes('Self'))it.worlds.push('Self');});
  const selfItems=items.filter(it=>it.k==='self');
  const selfReport=hasSelf?{mentions:selfItems.length,sources:[...new Set(selfItems.map(x=>x.source))].length,
    competitors:comps.map(c=>({name:c.name,type:c.type,n:items.filter(it=>wmatch(it,c.name)).length}))}:null;
  console.log(`\n${items.length} items kept from ${okFeeds} live feeds · worlds: ${WORLDS.join(', ')||'(none)'}`);

  const watchTerms=[...(OP.companies||[]),...(OP.people||[]),...(OP.keywords||[])].filter(Boolean);
  const hits=t=>{const s=(t.title+' '+t.snippet).toLowerCase();return watchTerms.filter(w=>s.includes(w.toLowerCase()));};

  /* 3. MONITOR (deterministic) */
  const monitor={markets:[],economy:[],events:[],signals:[],progress:[]};
  try{const j=await fetchX('https://open.er-api.com/v6/latest/USD',12000,true);const R=j.rates||{};
    if(R.NGN)monitor.markets.push({l:'USD / NGN',v:Math.round(R.NGN).toLocaleString()});
    if(R.GBP)monitor.markets.push({l:'GBP / USD',v:(1/R.GBP).toFixed(3)});
    if(R.EUR)monitor.markets.push({l:'EUR / USD',v:(1/R.EUR).toFixed(3)});
    console.log('  ok  FX');}catch(e){console.log('  --  FX: '+e.message);}
  for(const q of [{s:'^spx',l:'S&P 500'},{s:'^ukx',l:'FTSE 100'},{s:'xauusd',l:'Gold $'},{s:'cl.f',l:'WTI oil $'}]){
    try{const csv=await fetchX(`https://stooq.com/q/l/?s=${q.s}&f=sd2t2ohlcv&h&e=csv`,10000);
      const row=csv.trim().split('\n')[1];if(!row)continue;const close=row.split(',')[6];
      if(close&&close!=='N/D')monitor.markets.push({l:q.l,v:(+close).toLocaleString(undefined,{maximumFractionDigits:2})});
    }catch(e){}}
  async function wb(code,ind){for(let t=0;t<2;t++){try{const j=await fetchX(`https://api.worldbank.org/v2/country/${code}/indicator/${ind}?format=json&mrnev=1`,12000,true);const row=j?.[1]?.[0];if(row&&row.value!=null)return {value:row.value,year:row.date};}catch(e){}}return null;}
  for(const loc of [{scope:'Nigeria',code:'NGA',flag:'\uD83C\uDDF3\uD83C\uDDEC'},{scope:'Global',code:'WLD',flag:'\uD83C\uDF0D'}]){
    const gdp=await wb(loc.code,'NY.GDP.MKTP.KD.ZG');const inf=await wb(loc.code,'FP.CPI.TOTL.ZG');const m=[];
    if(gdp)m.push({l:`GDP growth (${gdp.year})`,v:gdp.value.toFixed(1)+'%',dir:gdp.value>=0?'up':'down'});
    if(inf)m.push({l:`Inflation (${inf.year})`,v:inf.value.toFixed(1)+'%'});
    if(m.length)monitor.economy.push({scope:loc.scope,flag:loc.flag,metrics:m});}
  for(const sc of ['Nigeria','Global']){if(!monitor.economy.some(e=>e.scope===sc)){const prev=PREV&&PREV.monitor&&(PREV.monitor.economy||[]).find(e=>e.scope===sc);if(prev)monitor.economy.push(prev);}}
  if(!monitor.markets.length&&PREV&&PREV.monitor&&Array.isArray(PREV.monitor.markets)&&PREV.monitor.markets.length)monitor.markets=PREV.monitor.markets;
  monitor.events=items.filter(x=>x.layer==='power').slice(0,8).map(x=>({title:x.title,url:x.url,tag:x.category}));

  /* 4. CURATE + ENRICH: AI picks must-reads for All AND for every world */
  const listing=items.map((it,i)=>`[${i}] {${it.layer}}${it.worlds.length?' <'+it.worlds.join('|')+'>':''} ${it.title} — ${it.source}`).join('\n');
  const profile=`OPERATOR — name: ${OP.name}; industries: ${(OP.industries||[]).join(', ')}; markets: ${(OP.markets||[]).join(', ')}; companies: ${(OP.companies||[]).join(', ')||'none'}; keywords: ${(OP.keywords||[]).join(', ')||'none'}; people: ${(OP.people||[]).join(', ')||'none'}. Worlds (tabs): ${WORLDS.join(', ')||'none'}.`;
  function baseFeed(){
    return items.map((it,i)=>({id:'s'+i,layer:it.layer,layerLabel:LAYER_LABEL[it.layer],category:it.category,worlds:it.worlds,selfKind:it.k||null,must:[],mustRead:false,headline:it.title,source:it.source,time:hoursAgo(it.date),peek:it.snippet||'',summary:it.snippet?[it.snippet]:[],why:'',simple:'',spectrum:null,sources:[{name:it.source,url:it.url,lean:'center'}],watch:hits(it)}));}
  function fallbackMusts(feed){
    feed.slice(0,4).forEach(f=>{f.must.push('All');f.mustRead=true;});
    for(const w of WORLDS){feed.filter(f=>f.worlds.includes(w)).slice(0,2).forEach(f=>{if(!f.must.includes(w))f.must.push(w);});}
    return feed;}
  let feed=baseFeed();let briefPart=null;const errs=[];
  if(!API_KEY){feed=fallbackMusts(feed);}
  else{
    try{
      const a=await claude(`You are the intelligence editor of a personal daily sweep. ${profile}\n\nITEMS (index {layer} <worlds> headline — source):\n${listing}\n\nSelect and enrich must-reads. Return JSON ONLY:\n{"picks":[{"i":0,"tabs":["All"],"peek":"<1 tight sentence>","summary":["<2-3 short key points>"],"why":"<1-2 sentences: why this matters to THIS operator>","simple":"<1 plain sentence>","spectrum":{"left":30,"center":50,"right":20}}]}\nRules: pick exactly 4 items with "All" in tabs (the day's highest-stakes across everything — major world/market events count even if outside the operator's niche). For EACH world in [${WORLDS.map(w=>'"'+w+'"').join(',')}] pick 2-3 items with that world in tabs (an item may carry several tabs). Never pick celebrity gossip or trivia. spectrum ~sums to 100.`,7000);
      const picks=a.picks||[];
      for(const p of picks){const f=feed[p.i];if(!f)continue;
        f.must=[...new Set([...(f.must||[]),...(p.tabs||[])])];
        if(f.must.includes('All'))f.mustRead=true;
        if(p.peek)f.peek=p.peek; if(p.summary&&p.summary.length)f.summary=p.summary;
        f.why=p.why||f.why; f.simple=p.simple||f.simple; f.spectrum=p.spectrum||f.spectrum;}
      if(!feed.some(f=>f.mustRead))fallbackMusts(feed);
      for(const w of WORLDS){if(!feed.some(f=>f.must.includes(w))){feed.filter(f=>f.worlds.includes(w)).slice(0,2).forEach(f=>f.must.push(w));}}
    }catch(e){errs.push('curate:'+e.message);feed=fallbackMusts(feed);}
    try{
      const missing=feed.map((f,idx)=>({f,idx})).filter(x=>(x.f.mustRead||((x.f.must||[]).length))&&!x.f.why).slice(0,16);
      if(missing.length){
        const ml=missing.map(x=>`[${x.idx}] ${x.f.headline} — ${x.f.source}${x.f.peek?' :: '+x.f.peek.slice(0,140):''}`).join('\n');
        const m=await claude(`${profile}\nEnrich these must-read items for the operator. Return JSON ONLY:\n{"items":[{"i":0,"peek":"<1 tight sentence>","summary":["<2-3 short key points>"],"why":"<1-2 sentences why this matters to THIS operator>","simple":"<1 plain sentence>","spectrum":{"left":30,"center":50,"right":20}}]}\nITEMS:\n${ml}`,4200);
        for(const e2 of (m.items||[])){const f=feed[e2.i];if(!f)continue;
          if(e2.peek)f.peek=e2.peek;if(e2.summary&&e2.summary.length)f.summary=e2.summary;
          f.why=e2.why||f.why;f.simple=e2.simple||f.simple;f.spectrum=e2.spectrum||f.spectrum;}
      }
    }catch(e){errs.push('fill:'+e.message);}
    try{
      const b=await claude(`You are chief analyst writing the morning synthesis for a builder-CEO. ${profile}\n\nITEMS:\n${items.slice(0,80).map((it,i)=>`[${i}] {${it.layer}} ${it.title} — ${it.source}`).join('\n')}\n\nReturn JSON ONLY:\n{"analysis":{"overview":"<4-5 sentence executive read connecting today's biggest forces to this operator's position — sophisticated, direct, zero fluff>","themes":[{"name":"<theme>","weight":7,"dir":"up"}],"risks":["<2-3 concrete>"],"opportunities":["<2-3 concrete>"],"selfRead":"<if items mention the operator or their companies: 1-2 sentences on their public presence today and what to do about it; else an empty string>"},"clusters":[{"title":"<theme>","bullets":["<3-4 lines>"],"why":"<1 sentence>","highlights":[0],"sources":[{"name":"<source>","url":""}]}],"signals":[{"text":"<1 line>","tag":"<tag>","dir":"up","url":""}],"progress":[{"tag":"Opportunity","title":"<short>","body":"<1 sentence>","url":""}]}\n5-7 weighted themes. 3-5 clusters. 4 signals. 3 progress.`,4000,ANALYSIS_MODEL);
      briefPart=b;
    }catch(e){errs.push('analysis:'+e.message);}
    const hardFail=errs.some(x=>x.startsWith('curate'))&&errs.some(x=>x.startsWith('analysis'));
    ENRICH=errs.length===0?'on':(hardFail?'failed: ':'partial: ')+errs.join('; ');
  }
  monitor.signals=(briefPart&&briefPart.signals)||[];monitor.progress=(briefPart&&briefPart.progress)||[];

  /* 5. ANALYTICS + LEARN */
  const byLayer={};feed.forEach(f=>{byLayer[f.layerLabel]=(byLayer[f.layerLabel]||0)+1;});
  let sp={left:0,center:0,right:0},spn=0;feed.forEach(f=>{if(f.spectrum){sp.left+=f.spectrum.left;sp.center+=f.spectrum.center;sp.right+=f.spectrum.right;spn++;}});
  sp=spn?{left:Math.round(sp.left/spn),center:Math.round(sp.center/spn),right:Math.round(sp.right/spn)}:null;
  const doy=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/86400000);
  const rot=(arr,off)=>arr.map((_,i)=>arr[(i+off)%arr.length]);
  const LEARN_BANKS={
    Strategy:rot([
      {title:'Concentrate your forces',body:"Greene's Law 23: spreading thin dilutes power. Pick the one prospect, one venture, one deliverable that moves the most, and pour in until it's inevitable."},
      {title:'The barbell',body:'Taleb: be extremely conservative with most of it and extremely bold with a little — never the mushy middle, which carries risk without upside.'},
      {title:'Tempo beats size',body:"Boyd's OODA loop: whoever observes, decides and acts faster sets the terms. Speed of decision is a weapon smaller players can own."},
      {title:'Win first, then fight',body:'Sun Tzu: victorious warriors win first and then go to war. Position until the outcome is nearly decided before you engage.'},
      {title:'Second-order thinking',body:'Howard Marks: the first conclusion is everyone\u2019s conclusion. Ask “and then what?” twice before acting.'},
      {title:'Schwerpunkt',body:'One focal point that everything serves. If an effort doesn\u2019t feed it, it\u2019s a distraction wearing work\u2019s clothes.'}],doy),
    Leverage:rot([
      {title:'Play long-term games with long-term people',body:"Naval: compounding trust and equity beats one-off wins. Choose partners you\u2019d want at year ten."},
      {title:'Armies that work while you sleep',body:'Naval: code and media are permissionless leverage — assets that scale without headcount.'},
      {title:'Specific knowledge',body:'Found by pursuing genuine curiosity until you\u2019re doing what looks like work to others and play to you. It can\u2019t be trained away.'},
      {title:'Distribution beats product',body:'The better product loses to the better channel more often than anyone admits. Build the audience before you need it.'},
      {title:'Reputation is pre-negotiation',body:'Most leverage is settled before anyone sits down — by what the other side already believes about you.'},
      {title:'Own equity',body:'Salaries don\u2019t compound. Some slice of ownership — in a company, a brand, a body of work — is the only exponential.'}],doy),
    Negotiation:rot([
      {title:'Anchor, then go quiet',body:'State your number clearly and stop talking. Silence transfers pressure and protects your position without argument.'},
      {title:'Calibrated questions',body:'Voss: “How am I supposed to do that?” makes the other side solve your problem while feeling in control.'},
      {title:'BATNA is the real power',body:'Build your walk-away before you sit down. The side that needs the deal least writes the terms.'},
      {title:'Label the emotion',body:'Voss: “It seems like this feels rushed…” Naming the feeling defuses it faster than answering it.'},
      {title:'Trade cheap for dear',body:'Give what costs you little and means much to them; take what costs them little and compounds for you.'},
      {title:'Deadlines cut both ways',body:'Whoever needs the close pays for it. Know which side of the clock you\u2019re on before you concede anything.'}],doy),
    Craft:rot([
      {title:'Ship the finished thing',body:'A deployable draft beats a perfect plan. Reduce the loop between idea and artifact — momentum is a moat.'},
      {title:'The taste gap',body:'Ira Glass: your taste outruns your skill for years. The only bridge is volume — keep producing until the work catches your eye.'},
      {title:'Make it work, right, fast',body:'Kent Beck\u2019s order of operations. Reversing it is how projects die polished and unshipped.'},
      {title:'Constraints breed style',body:'A signature is a set of chosen limits. Pick harder constraints on purpose and the work starts looking like you.'},
      {title:'Quality is the plan',body:'Do it so well the work becomes the marketing. Excellence is the cheapest distribution ever invented.'},
      {title:'Finish like it\u2019s signed',body:'The last 10% — the naming, the kerning, the send — is where the brand lives. Under the highest witness, finish.'}],doy),
    Proverbial:rot(PROVERBS.map(p=>({title:p.t,body:p.b})),doy)
  };
  const learn=Object.entries(LEARN_BANKS).map(([tag,arr])=>({tag,title:arr[0].title,body:arr[0].body}));

  /* 6. WRITE */
  const doc={updatedAt:new Date().toISOString(),_enrichment:ENRICH,
    operator:OP,worlds:WORLDS,
    feed,
    brief:{date:new Date().toLocaleDateString('en-GB',{weekday:'long',month:'long',day:'numeric'}),greeting:`Good morning, ${OP.name}`,clusters:(briefPart&&briefPart.clusters)||[],analysis:(briefPart&&briefPart.analysis)||null},
    monitor,
    self:selfReport?{report:selfReport,read:(briefPart&&briefPart.analysis&&briefPart.analysis.selfRead)||''}:null,
    analytics:{byLayer,spectrum:sp,liveFeeds:okFeeds,items:feed.length},
    learn,learnBanks:LEARN_BANKS};
  await writeFile('feed.json',JSON.stringify(doc,null,2));
  console.log(`\nWrote feed.json — enrichment ${ENRICH}, ${feed.length} items, ${WORLDS.length} worlds, ${feed.filter(f=>f.mustRead).length} global must-reads.`);
}
main().catch(async(e)=>{console.error('Sweep error (publishing empty feed so the job still succeeds):',e.message);
  try{await writeFile('feed.json',JSON.stringify({updatedAt:new Date().toISOString(),_enrichment:'failed: '+e.message,feed:[],worlds:[],brief:{date:new Date().toDateString(),greeting:'Good morning',clusters:[],analysis:null},monitor:{markets:[],economy:[],events:[],signals:[],progress:[]},analytics:{},learn:[]},null,2));}catch{}
  process.exit(0);});
