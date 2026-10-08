(() => {
  'use strict';
  const data=JSON.parse(document.getElementById('guide-data').textContent), index=GuideCore.createIndex(data);
  const app=document.getElementById('app'), breadcrumb=document.getElementById('breadcrumb'), globalQ=document.getElementById('global-q');
  const countryByCode=new Map(data.countries.map(c=>[c.code,c]));
  const topicById=new Map([...data.topics,{id:'resources',name:'附录与资料',description:'身份说明、情境路线、来源和编辑说明。'}].map(t=>[t.id,t]));
  const personas=[
    {id:'citizen',name:'已入籍的当地华人',short:'当地公民',tag:'A',description:'持目的地国籍。按公民身份核对医保、工作、税务与家庭安排。',note:'公民身份也不代表自动满足每项补助、居住或缴费条件。'},
    {id:'pr',name:'中国籍永久居民',short:'中国籍永久居民',tag:'B',description:'保留中国国籍，持绿卡、PR、永住等永久居留身份。',note:'永久居留与公民身份不同，福利、选举和领事渠道应分别核对。'},
    {id:'visa',name:'留学、工作或家属签证',short:'临时签证',tag:'C',description:'根据签证类别安排学习、就业、保险、住房与到期提醒。',note:'工作授权、可办业务和保障资格取决于具体签证与个人情况。'},
    {id:'visitor',name:'旅游、探亲或短期停留',short:'游客与短期访客',tag:'D',description:'从行程、住宿交通、旅行医疗保障和紧急联系入手。',note:'先看短期可用的行动，不把居民医保和长期补助列为确定预算。'}
  ];
  const personaById=new Map(personas.map(p=>[p.id,p]));
  let persona='',saved=new Set(),searchLimit=30,previousView='',toastTimer;
  try {const stored=localStorage.getItem('overseas-life-guide-persona');if(personaById.has(stored))persona=stored;}catch{}
  try {saved=new Set(JSON.parse(localStorage.getItem('overseas-life-guide-saved')||'[]'));}catch{}
  saved=new Set([...saved].map(id=>{const r=index.resolve(id);return r?.entry?.id||r?.chapter?.id;}).filter(Boolean));
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trimTitle=title=>title.replace(/^\d+[.、\s]+/,'');
  const route=()=>GuideCore.parseRoute(location.hash);
  const href=id=>'#'+encodeURIComponent(id);
  const countryPath=(code,view='topics',topic='')=>'#nav/'+code+'/'+view+(topic?'/'+topic:'');
  function go(target){if(location.hash==='#'+target)render();else location.hash=target;}
  function toast(message){const el=document.getElementById('toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2600);}
  function saveState(){try{localStorage.setItem('overseas-life-guide-saved',JSON.stringify([...saved]));}catch{toast('此浏览器暂时无法保存收藏，本次阅读仍可使用。');}updateSaveCount();}
  function setPersona(value){if(!personaById.has(value))return;persona=value;try{localStorage.setItem('overseas-life-guide-persona',value);}catch{} }
  function updateSaveCount(){document.getElementById('save-count').textContent=String(saved.size);}
  function personaOptions(){return (!persona?'<option value="" selected disabled>请选择自己的身份</option>':'')+personas.map(p=>`<option value="${p.id}"${p.id===persona?' selected':''}>${esc(p.short)}</option>`).join('');}
  function topicOptions(selected,all=false){return `${all?'<option value="all">全部板块</option>':''}${[...data.topics,topicById.get('resources')].map(t=>`<option value="${t.id}"${selected===t.id?' selected':''}>${t.name}</option>`).join('')}`;}
  function countryOptions(selected,all=false){return `${all?'<option value="all">全部国家</option>':''}${data.countries.map(c=>`<option value="${c.code}"${selected===c.code?' selected':''}>${c.name}</option>`).join('')}`;}
  function pathStrip(code){return `<div class="path-strip"><span class="grow"><strong>${countryByCode.get(code).name}</strong> <span class="path-extra">· 选择眼前需要处理的事</span></span><label>当前身份 <select data-persona aria-label="更改当前读者身份">${personaOptions()}</select></label><a href="${countryPath(code,'identity')}">重新选择</a></div>`;}
  function crumbs(items){breadcrumb.innerHTML=[['首页','#home'],...items].map((item,n)=>(n?'<span class="sep" aria-hidden="true">/</span>':'')+(item[1]?`<a href="${item[1]}">${esc(item[0])}</a>`:`<span aria-current="page">${esc(item[0])}</span>`)).join('');}
  function findGuide(code){return data.chapters.find(c=>c.country===code&&c.kind==='guide');}
  function chaptersFor(code,topic){const order={depth:0,guide:1,chapter:2,resource:3};return data.chapters.filter(c=>c.country===code&&c.topic===topic).sort((a,b)=>(order[a.kind]??9)-(order[b.kind]??9));}
  function topicPills(code,selected){return `<nav class="subnav" aria-label="切换生活板块">${data.topics.map(t=>`<button class="pill" data-go="nav/${code}/topic/${t.id}" aria-pressed="${selected===t.id}">${t.name}</button>`).join('')}<button class="pill" data-go="nav/${code}/topic/resources" aria-pressed="${selected==='resources'}">附录与资料</button></nav>`;}
  function depthCount(code){return data.chapters.filter(c=>c.country===code&&c.kind==='depth').reduce((n,c)=>n+c.entries.length,0);}
  function home(){
    crumbs([]);
    app.innerHTML=`<div class="eyebrow">国家 → 生活板块 → 问题目录</div><h1>你准备去哪里生活或旅行？</h1><p class="lead">选国家即可看到板块和目录。选择自己的身份，再按实际情况办理。</p><div class="country-grid">${data.countries.map(c=>`<button class="country-card" data-go="nav/${c.code}/topics"><span class="country-top"><span class="country-code">${c.code}</span><span class="arrow" aria-hidden="true">↗</span></span><strong>${c.name}</strong><small>${depthCount(c.code)} 个深度问答<br>另有 ${c.chapters} 章 · ${c.entries.toLocaleString('zh-CN')} 条原有建议</small></button>`).join('')}</div><div class="home-bottom"><div class="howto"><div class="howto-step"><span>01 / 选目的地</span><b>进入一个国家</b>住房、医疗、工作等内容按国家整理。</div><div class="howto-step"><span>02 / 选生活板块</span><b>直达需要的主题</b>签证、住房、工作、医保、税务、旅游优先扩写。</div><div class="howto-step"><span>03 / 选具体问题</span><b>阅读完整做法</b>步骤、材料、费用演算、案例和问题处理。</div></div><aside class="home-note"><p>已经知道要找什么？使用顶部全文搜索，或打开自己的收藏。</p><p>所有正文都在本页内。点击页脚“保存离线版”，可在没有网络时继续查阅；外部官方来源仍需联网。</p><a href="https://github.com/gerrygao1995-coder/overseas-life-guide/blob/main/TRANSLATION.md">了解本指南的来源与适用范围 ↗</a></aside></div>`;
  }
  function identity(code){
    const country=countryByCode.get(code);if(!country)return home();
    crumbs([[country.name,countryPath(code)],['选择身份',null]]);
    app.innerHTML=`<button class="back" data-go="home">← 返回选择国家</button><div class="eyebrow">${country.name} / 第 2 步</div><h1>你目前是哪种身份？</h1><p class="lead">选择最接近的一项。它会帮助你在正文中找到自己的路径，之后随时可以更改。</p><div class="identity-grid">${personas.map(p=>`<button class="identity-card" data-identity="${p.id}" data-country="${code}"><span class="identity-letter">${p.tag}</span><span><strong>${p.name}</strong><small>${p.description}</small></span></button>`).join('')}</div><p class="inline-note">暂时拿不准？<a href="${href(findGuide(code).id)}">先读${country.name}身份与落地说明</a>。选择只保存在当前设备上，无需提供个人证件。</p>`;
  }
  function topics(code){
    const country=countryByCode.get(code);if(!country)return home();
    crumbs([[country.name,null]]);
    app.innerHTML=`<button class="back" data-go="home">← 返回选择国家</button><div class="section-header"><div><div class="eyebrow">${country.name} / 第 2 步</div><h1>现在想处理什么？</h1><p class="lead">先选生活板块，再从目录打开具体做法。</p></div><a class="small" href="#home">换一个国家</a></div>${pathStrip(code)}<div class="topic-grid">${data.topics.map(t=>{const list=chaptersFor(code,t.id),count=list.filter(c=>c.kind==='chapter').length,deep=list.filter(c=>c.kind==='depth').reduce((n,c)=>n+c.entries.length,0);return `<button class="topic-card" data-go="nav/${code}/topic/${t.id}"><span class="topic-number">${t.icon}<span aria-hidden="true">↗</span></span><strong>${t.name}</strong><small>${t.short}</small><span class="topic-count">${deep?deep+' 个问题详解 · ':''}${count?count+' 个原有章节':'身份与落地指引'}</span></button>`;}).join('')}</div><div class="resource-row"><a href="${href(findGuide(code).id)}">身份与落地说明</a><a href="${countryPath(code,'topic','resources')}">情境路线、附录与来源</a><a href="${country.file}" download>下载${country.name}原有分卷</a><a href="${href(GuideCore.searchHash({country:code,saved:true}))}">查看${country.name}收藏</a></div>`;
  }
  function topic(code,topicId){
    const country=countryByCode.get(code),selected=topicById.get(topicId);if(!country||!selected)return topics(code);
    const chapters=chaptersFor(code,topicId);
    crumbs([[country.name,countryPath(code)],[selected.name,null]]);
    app.innerHTML=`<button class="back" data-go="nav/${code}/topics">← 返回生活板块</button><div class="eyebrow">${country.name} / ${selected.name}</div><h1>${selected.name}</h1><p class="lead">${selected.description} 选择一章，查看条目目录。</p>${pathStrip(code)}${topicPills(code,topicId)}${topicId!=='arrival'&&topicId!=='resources'?`<div class="starting-point"><p><strong>先分清资格，再安排预算。</strong> ${personaById.get(persona)?.note||'请先选择自己的身份，再按具体项目核对适用条件。'}</p><a href="${href(findGuide(code).id)}">查看身份路径 →</a></div>`:''}<div class="chapter-list">${chapters.map((chapter,n)=>`<a class="chapter-row" href="${href(chapter.id)}"><span class="chapter-number">${chapter.number?String(chapter.number).padStart(2,'0'):'↗'}</span><span class="grow"><strong>${esc(trimTitle(chapter.title))}</strong><small>${chapter.entries.length} 个${chapter.kind==='chapter'?'行动条目':chapter.kind==='depth'?'问题详解':'阅读小节'}${chapter.kind==='guide'?' · 建议先读':chapter.kind==='depth'?' · 深度手册 · 优先阅读':''}</small></span><span class="arrow" aria-hidden="true">→</span></a>`).join('')}</div>`;
  }
  function reading(id){
    const resolved=index.resolve(id);
    if(!resolved){crumbs([['找不到这个位置',null]]);app.innerHTML='<div class="empty"><strong>这个链接暂时找不到</strong><p>可以返回国家目录，或用顶部搜索查找标题与关键词。</p><button class="primary" data-go="home">返回首页</button></div>';return;}
    const {chapter,entry}=resolved,country=countryByCode.get(chapter.country),topicInfo=topicById.get(chapter.topic);
    const chapterChoices=chaptersFor(chapter.country,chapter.topic);
    const title=entry?entry.title:chapter.title,canonical=entry?entry.id:chapter.id;
    const chapterOptions=chapterChoices.map(c=>`<option value="${esc(c.id)}"${c.id===chapter.id?' selected':''}>${esc(c.title)}</option>`).join('');
    const entryOptions=`<option value="${esc(chapter.id)}"${entry?'':' selected'}>本章目录与说明</option>`+chapter.entries.map((e,n)=>`<option value="${esc(e.id)}"${entry?.id===e.id?' selected':''}>${n+1}. ${esc(trimTitle(e.title))}</option>`).join('');
    crumbs([[country.name,countryPath(chapter.country)],[topicInfo.name,countryPath(chapter.country,'topic',chapter.topic)],[trimTitle(chapter.title),entry?href(chapter.id):null],...(entry?[['正在阅读',null]]:[])]);
    app.innerHTML=`<div class="mobile-toc"><div class="mobile-pair"><label>生活板块<select data-topic-switch data-country="${chapter.country}">${topicOptions(chapter.topic)}</select></label><label>章节<select data-jump>${chapterOptions}</select></label></div><label>条目目录<select data-jump aria-label="选择要阅读的具体条目">${entryOptions}</select></label></div><div class="reader-layout"><aside class="sidebar" aria-label="阅读目录"><button class="back" data-go="nav/${chapter.country}/topic/${chapter.topic}">← 返回${topicInfo.name}</button><div class="side-section"><label for="side-topic">生活板块</label><select id="side-topic" data-topic-switch data-country="${chapter.country}">${topicOptions(chapter.topic)}</select></div><div class="side-section"><label for="side-chapter">选择章节</label><select id="side-chapter" data-jump>${chapterOptions}</select></div><div class="toc-label">本章目录 · ${chapter.entries.length} ${chapter.kind==='chapter'?'条':'节'}</div><nav class="toc"><a href="${href(chapter.id)}" aria-current="${!entry}"><span class="toc-num">↗</span><span>本章说明与全部条目</span></a>${chapter.entries.map((e,n)=>`<a href="${href(e.id)}" aria-current="${entry?.id===e.id}"><span class="toc-num">${n+1}</span><span>${esc(trimTitle(e.title))}</span></a>`).join('')}</nav><div class="sidebar-bottom">每次显示一个条目。左侧目录、页面下方的上一篇／下一篇都可以切换。<br><br><a href="${countryPath(chapter.country)}">查看其他生活板块</a></div></aside><article class="reading-panel" aria-labelledby="reading-title"><div class="reading-meta"><span>${country.name} · ${topicInfo.name}${entry?' · '+entry.order+' / '+chapter.entries.length:''}</span><div class="reading-tools"><button data-save="${esc(canonical)}" aria-pressed="${saved.has(canonical)}" aria-label="${saved.has(canonical)?'取消收藏':'收藏'}当前${entry?'条目':'章节'}">${saved.has(canonical)?'★ 已收藏':'☆ 收藏'}</button><button data-copy="${esc(canonical)}">复制链接</button></div></div><h1 id="reading-title">${esc(title)}</h1><div class="reader-path"><span>当前阅读路径</span><select data-persona aria-label="选择读者身份">${personaOptions()}</select><span>· 按正文条件核对资格</span></div><div id="audience-focus" hidden></div>${entry?`<div class="reading-content" id="reading-content">${entry.html}</div>`:`<details class="chapter-intro" ${chapter.kind==='guide'?'open':''}><summary>本章说明与原文导航</summary><div class="reading-content" id="reading-content">${chapter.intro}</div></details><h2 style="font-size:17px">${chapter.kind==='chapter'?'选择要阅读的条目':'阅读小节'}</h2><div class="entry-list">${chapter.entries.map((e,n)=>`<a class="entry-link" href="${href(e.id)}"><span class="entry-num">${String(n+1).padStart(2,'0')}</span><span><strong>${esc(trimTitle(e.title))}</strong>${e.summary?`<small>${esc(e.summary)}</small>`:''}</span></a>`).join('')}</div>`}${pagination(chapter,entry)}</article></div>`;
    const content=document.getElementById('reading-content');
    const firstHeading=content?.querySelector('h2,h3,h4,h5');
    if(firstHeading&&GuideCore.normalize(firstHeading.textContent)===GuideCore.normalize(title))firstHeading.hidden=true;
    highlightPersona(content);
    if(entry){const selectedLink=app.querySelector('.toc [aria-current="true"]');if(selectedLink)selectedLink.scrollIntoView({block:'nearest'});}
    // Legacy secondary anchors may point deeper inside the currently selected entry.
    if(id!==canonical){requestAnimationFrame(()=>{const target=document.getElementById(id);if(target&&target.closest('#reading-content'))target.scrollIntoView({block:'start'});});}
  }
  function pagination(chapter,entry){
    if(!entry)return chapter.entries.length?`<nav class="entry-pagination" aria-label="阅读顺序"><a href="${href(chapter.entries[0].id)}"><span>从第一条开始</span>${esc(chapter.entries[0].title)} →</a></nav>`:'';
    const n=chapter.entries.findIndex(e=>e.id===entry.id),previous=chapter.entries[n-1],next=chapter.entries[n+1];
    return `<nav class="entry-pagination" aria-label="阅读顺序">${previous?`<a href="${href(previous.id)}"><span>← 上一条</span>${esc(previous.title)}</a>`:`<a href="${href(chapter.id)}"><span>← 本章目录</span>查看全部条目</a>`}${next?`<a href="${href(next.id)}"><span>下一条 →</span>${esc(next.title)}</a>`:`<a href="${countryPath(chapter.country,'topic',chapter.topic)}"><span>本章已读到末尾 →</span>查看其他章节</a>`}</nav>`;
  }
  function highlightPersona(content){
    if(!content)return;
    if(!personaById.has(persona))return;
    const expressions={citizen:/公民|已入籍|日本籍|韩国籍|华裔美国|定居华人/,pr:/永久|绿卡|永住|中国籍定居|定居华人/,visa:/临时签证|签证|留学|工作[／/].*家属/,visitor:/游客|旅游|短期|探亲|探访/};
    const regex=expressions[persona];let selected='';
    content.querySelectorAll('.identity-match').forEach(e=>e.classList.remove('identity-match'));
    content.querySelectorAll('tr').forEach(row=>{const cells=row.querySelectorAll('td');if(cells.length>1&&regex.test(cells[0].textContent)){row.classList.add('identity-match');if(!selected)selected=cells[1].textContent.trim();}});
    content.querySelectorAll('p').forEach(p=>{const lead=p.querySelector('strong');if(lead&&regex.test(lead.textContent)&&lead.textContent.length<35){p.classList.add('identity-match');if(!selected)selected=p.textContent.trim();}
      if(lead?.textContent.includes('中国读者怎么用')){const label=persona==='visitor'?'游客':persona==='visa'?'签证':'定居';const m=p.textContent.match(new RegExp(label+'[：:]([\\s\\S]*?)(?=(?:定居|签证|游客)[：:]|$)'));if(m)selected=m[1].trim();}
    });
    const focus=document.getElementById('audience-focus');
    if(focus){focus.hidden=!selected;focus.className='starting-point';focus.innerHTML=selected?`<p><strong>${esc(personaById.get(persona).short)} · 与你相关的路径</strong><br>${esc(selected)}</p>`:'';}
  }
  function searchView(state){
    if(!countryByCode.has(state.country)&&state.country!=='all')state.country='all';
    if(!topicById.has(state.topic)&&state.topic!=='all')state.topic='all';
    crumbs([[state.saved?'我的收藏':'全文搜索',null]]);
    globalQ.value=state.query;
    app.innerHTML=`<button class="back" data-go="${state.country==='all'?'home':'nav/'+state.country+'/topics'}">← 返回${state.country==='all'?'选择国家':countryByCode.get(state.country).name+'生活板块'}</button><div class="eyebrow">${state.saved?'保存在当前设备':'搜索完整正文'}</div><h1>${state.saved?'我的收藏':'你想找什么？'}</h1><p class="lead">${state.saved?'收藏的章节与条目都在这里，也可以继续按国家、板块和关键词查找。':'按条目查找，可以组合关键词，例如“游客 医保”或“租房 押金”。'}</p><div class="search-filters"><label class="filter-input">关键词<input id="find-q" type="search" value="${esc(state.query)}" placeholder="例如：医保、租房、工作、税务" autocomplete="off"></label><label>国家<select id="find-country">${countryOptions(state.country,true)}</select></label><label>生活板块<select id="find-topic">${topicOptions(state.topic,true)}</select></label></div><div id="find-status" class="small" role="status" aria-live="polite" style="margin-bottom:15px"></div><div id="search-results" class="search-results"></div><button id="find-more" class="secondary more" hidden>再显示 30 条</button>`;
    const fields=['find-q','find-country','find-topic'].map(id=>document.getElementById(id));
    let debounce;
    function refresh(reset=true){
      if(reset)searchLimit=30;
      const current={query:fields[0].value,country:fields[1].value,topic:fields[2].value,saved:state.saved};
      history.replaceState(null,'','#'+GuideCore.searchHash(current));
      globalQ.value=current.query;
      const matches=index.search(current.query,{country:current.country,topic:current.topic,saved:current.saved?saved:null});
      const status=document.getElementById('find-status');status.textContent=`${matches.length} 个匹配结果${current.query?' · '+current.query:''}`;
      document.getElementById('search-results').innerHTML=matches.slice(0,searchLimit).map(r=>`<a class="search-result" href="${href(r.id)}"><small>${countryByCode.get(r.chapter.country).name} / ${topicById.get(r.chapter.topic).name} / ${esc(trimTitle(r.chapter.title))}${r.isOverview?' · 章节目录':''}</small><strong>${mark(r.title,current.query)}</strong><p>${mark(excerpt(r.text,current.query),current.query)}</p></a>`).join('')||`<div class="empty"><strong>${current.saved&&saved.size===0?'还没有收藏':'没有找到匹配内容'}</strong><p>${current.saved&&saved.size===0?'阅读时点一下“☆ 收藏”，下次就能从这里直接打开。':'试试更短的关键词，或把国家和生活板块切换为“全部”。'}</p>${current.saved&&saved.size===0?'<button class="primary" data-go="home">开始浏览指南</button>':''}</div>`;
      document.getElementById('find-more').hidden=matches.length<=searchLimit;
    }
    fields[0].addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>refresh(),160);});
    fields.slice(1).forEach(field=>field.addEventListener('change',()=>refresh()));
    document.getElementById('find-more').addEventListener('click',()=>{searchLimit+=30;refresh(false);});
    refresh();
  }
  function excerpt(text,query){const plain=String(text||'').replace(/\s+/g,' '),words=GuideCore.normalize(query).split(' ').filter(Boolean);const at=words.length?GuideCore.normalize(plain).indexOf(words[0]):0;const start=Math.max(0,at-32);return (start?'…':'')+plain.slice(start,start+150)+(plain.length>start+150?'…':'');}
  function mark(text,query){let value=esc(text);const words=[...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a,b)=>b.length-a.length);if(!words.length)return value;const pattern=words.map(w=>esc(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');try{return value.replace(new RegExp(pattern,'gi'),m=>'<mark>'+m+'</mark>');}catch{return value;}}
  function currentCountry(){const state=route();if(state.country&&countryByCode.has(state.country))return state.country;if(state.view==='reader')return index.resolve(state.id)?.chapter.country||'all';return 'all';}
  function render(){
    const state=route();
    if(state.view==='home')home();
    else if(state.view==='identity')identity(state.country);
    else if(state.view==='topics')topics(state.country);
    else if(state.view==='topic')topic(state.country,state.topic);
    else if(state.view==='reader')reading(state.id);
    else if(state.view==='search')searchView(state);
    updateSaveCount();
    document.title=(state.view==='reader'?index.resolve(state.id)?.entry?.title||index.resolve(state.id)?.chapter?.title:state.country?countryByCode.get(state.country)?.name:'')?.replace(/^undefined$/,'')+'｜中国人在海外的生活指南';
    if(document.title.startsWith('｜')||document.title.startsWith('undefined'))document.title='中国人在海外的生活指南';
    if(previousView){window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});}
    previousView=state.view;
  }
  document.getElementById('global-search').addEventListener('submit',event=>{event.preventDefault();go(GuideCore.searchHash({query:globalQ.value,country:currentCountry()}));});
  document.getElementById('open-saved').addEventListener('click',()=>go(GuideCore.searchHash({saved:true,country:currentCountry()})));
  app.addEventListener('change',event=>{
    const el=event.target;
    if(el.matches('[data-persona]')){setPersona(el.value);app.querySelectorAll('[data-persona]').forEach(other=>other.value=persona);if(route().view==='reader')highlightPersona(document.getElementById('reading-content'));else if(route().view==='topic')topic(route().country,route().topic);}
    if(el.matches('[data-jump]'))go(el.value);
    if(el.matches('[data-topic-switch]'))go('nav/'+el.dataset.country+'/topic/'+el.value);
  });
  app.addEventListener('click',async event=>{
    const button=event.target.closest('button');
    if(button?.dataset.go){go(button.dataset.go);return;}
    if(button?.dataset.identity){setPersona(button.dataset.identity);go('nav/'+button.dataset.country+'/topics');return;}
    if(button?.dataset.save){const id=button.dataset.save;if(saved.has(id))saved.delete(id);else saved.add(id);saveState();button.textContent=saved.has(id)?'★ 已收藏':'☆ 收藏';button.setAttribute('aria-pressed',String(saved.has(id)));button.setAttribute('aria-label',saved.has(id)?'取消收藏当前内容':'收藏当前内容');toast(saved.has(id)?'已加入收藏':'已取消收藏');return;}
    if(button?.dataset.copy){const url=location.href.split('#')[0]+'#'+encodeURIComponent(button.dataset.copy);try{await navigator.clipboard.writeText(url);toast('链接已复制');}catch{go(button.dataset.copy);toast('链接已放入地址栏，可以直接复制。');}return;}
    const link=event.target.closest('a');if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=link.getAttribute('href')||'';
    if(/^README\.md(?:#.*)?$/.test(target)){event.preventDefault();const code=currentCountry();go(code==='all'?'home':'nav/'+code+'/topics');return;}
    const localBook=target.match(/^(?:US|AU|KR|JP)\.md#(.+)$/i);if(localBook){event.preventDefault();go(decodeURIComponent(localBook[1]));}
  });
  window.addEventListener('hashchange',render);
  render();
})();
