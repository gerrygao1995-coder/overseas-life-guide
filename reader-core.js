/* Pure navigation and search helpers; also exercised by verify_reader.cjs. */
(function (root) {
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  function createIndex(data) {
    const chapters = new Map(data.chapters.map(c => [c.id, c]));
    const entries = new Map();
    const records = [];
    for (const chapter of data.chapters) {
      records.push({ id: chapter.id, chapter, entry: null, title: chapter.title, text: chapter.introText, search: normalize(chapter.title + ' ' + chapter.introText), isOverview: true });
      for (const entry of chapter.entries) {
        entries.set(entry.id, {chapter, entry});
        records.push({ id: entry.id, chapter, entry, title: entry.title, text: entry.text, search: normalize(chapter.title + ' ' + entry.title + ' ' + entry.text), isOverview: false });
      }
    }
    function resolve(id) {
      const pair = data.aliases[id];
      if (pair) return {chapter: chapters.get(pair[0]), entry: pair[1] ? entries.get(pair[1])?.entry : null, anchor: id};
      if (chapters.has(id)) return {chapter: chapters.get(id), entry:null, anchor:id};
      if (entries.has(id)) return {...entries.get(id), anchor:id};
      return null;
    }
    function search(query, {country='all', topic='all', saved=null}={}) {
      const words = normalize(query).split(' ').filter(Boolean);
      return records.filter(r => (country === 'all' || r.chapter.country === country) && (topic === 'all' || r.chapter.topic === topic) && (!saved || saved.has(r.id)) && words.every(w => r.search.includes(w)))
        .map(r => ({...r, score:words.reduce((n,w) => n+(normalize(r.title).includes(w)?5:1), 0)+(r.isOverview?0:1)}))
        .sort((a,b) => b.score-a.score);
    }
    return {chapters, entries, records, resolve, search};
  }
  function parseRoute(hash) {
    const raw=String(hash||'').replace(/^#/,'');
    // Search query components are decoded by URLSearchParams, not twice.
    let value;try { value=raw.startsWith('search?')?raw:decodeURIComponent(raw); } catch { value=''; }
    if (!value || value==='home' || value==='library') return {view:'home'};
    if (value.startsWith('search?')) {
      const params=new URLSearchParams(value.slice(7));
      return {view:'search',query:params.get('q')||'',country:params.get('country')||'all',topic:params.get('topic')||'all',saved:params.get('saved')==='1'};
    }
    if (value.startsWith('nav/')) {
      const [,country,view,topic]=value.split('/');
      return {view: view==='identity'?'identity':view==='topic'?'topic':'topics',country,topic};
    }
    return {view:'reader',id:value};
  }
  function searchHash({query='',country='all',topic='all',saved=false}={}) {
    return 'search?'+new URLSearchParams({q:query,country,topic,saved:saved?'1':'0'}).toString();
  }
  root.GuideCore={normalize,createIndex,parseRoute,searchHash};
})(typeof globalThis!=='undefined'?globalThis:this);
