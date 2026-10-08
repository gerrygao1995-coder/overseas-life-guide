"""Build the complete offline Chinese guide as a country/topic/entry reader.

Input: the existing four aggregate Markdown books and manifest.json.
No dependency is required. Legacy anchors resolve to their exact entry.
Usage: python build_reader.py --source ../../outputs/overseas-life-guide-public --out preview
"""
from pathlib import Path
import argparse, hashlib, html, json, re, shutil

HERE=Path(__file__).resolve().parent
TOPICS=[
    {'id':'arrival','name':'签证与落地','short':'签证 · 身份 · 必备手续','icon':'01','description':'先把签证、停留期限和必要材料理清。'},
    {'id':'health','name':'医疗与健康','short':'医保 · 就医 · 身心健康','icon':'02','description':'找到合适的就医渠道，问清保障与费用。'},
    {'id':'housing','name':'住房与搬家','short':'租房 · 购房 · 安居','icon':'03','description':'从看合同、核查房屋，到搬家的准备。'},
    {'id':'work','name':'工作与学习','short':'就业 · 留学 · 职业发展','icon':'04','description':'分清工作授权、劳动权益和学习资源。'},
    {'id':'money','name':'钱、税与退休','short':'银行 · 税务 · 养老规划','icon':'05','description':'管理现金流，核对税务、保险和福利资格。'},
    {'id':'family','name':'家庭与照护','short':'育儿 · 关系 · 长辈照护','icon':'06','description':'把家人的需要变成可执行的安排。'},
    {'id':'travel','name':'旅行与安全','short':'交通 · 急救 · 应急准备','icon':'07','description':'安排出行，保存求助入口并减少事故风险。'},
    {'id':'everyday','name':'日常与权益','short':'消费 · 法律 · 数字生活','icon':'08','description':'少花冤枉钱，处理生活小事和消费纠纷。'},
]
# Stable chapter numbers come from the original fixed source projects.
GROUPS={
 'US':{'arrival':[36,39], 'health':[1,2,4,5,22,25,26,28], 'housing':[11,30,31], 'work':[13,14,15,16,33,37], 'money':[7,8,9,10,29,32], 'family':[6,19,20,21,27], 'travel':[3,12,24,35,38], 'everyday':[17,18,23,34,40]},
 'AU':{'arrival':[33,37], 'health':[2,3,4,19,23,24], 'housing':[6,29,36], 'work':[10,11,16,32,38], 'money':[7,8,9,28], 'family':[12,13,20,21,22,30,40], 'travel':[1,17,25,26], 'everyday':[5,14,15,18,27,31,34,35,39]},
 'KR':{'arrival':[28], 'health':[1,11,12,13,16], 'housing':[3,35], 'work':[6,22,23,25,26,27], 'money':[4,7,33], 'family':[8,14,15,18,19,29,30,36], 'travel':[2,5,32], 'everyday':[9,10,17,20,21,24,31,34]},
 'JP':{'arrival':[46], 'health':[1,2,3,4,7,9,10,11,12,13,14,15,16], 'housing':[33,34,44,45], 'work':[20,21,22,29,30,39,41], 'money':[17,18,19,25,26,27,28,31,32], 'family':[8,35,36,37,40,48], 'travel':[5,6,38,42], 'everyday':[23,24,43,47]},
}

def inline(s):
    tokens=[]
    def save(value):tokens.append(value);return '\x00'+str(len(tokens)-1)+'\x00'
    def link(m):
        label=re.sub(r'\\([\[\]\\])',r'\1',m[1])
        target=m[2]
        if re.match(r'(?i)(javascript|data|vbscript):',target):return html.escape(label)
        return save('<a href="'+html.escape(target,quote=True)+'"'+(' target="_blank" rel="noopener noreferrer"' if target.startswith(('https:','http:')) else '')+'>'+html.escape(label)+'</a>')
    s=re.sub(r'\[((?:\\.|[^\]\\])+)\]\(([^)]+)\)',link,s)
    s=html.escape(s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',s)
    s=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<em>\1</em>',s)
    s=re.sub(r'`([^`]+)`',r'<code>\1</code>',s)
    return re.sub(r'\x00(\d+)\x00',lambda m:tokens[int(m[1])],s)

def render(text):
    out=[];lines=text.splitlines();i=0
    while i<len(lines):
        line=lines[i].strip();i+=1
        if not line:continue
        if re.fullmatch(r'<a id="[^"]+"></a>',line):out.append(line);continue
        if line in ('<details>','</details>'):out.append(line);continue
        summary=re.fullmatch(r'<summary>(.*?)</summary>',line)
        if summary:out.append('<summary>'+inline(summary[1])+'</summary>');continue
        if line.startswith('```'):
            code=[]
            while i<len(lines) and not lines[i].strip().startswith('```'):code.append(lines[i]);i+=1
            i+=1;out.append('<pre><code>'+html.escape('\n'.join(code))+'</code></pre>');continue
        if line.startswith('|') and i<len(lines) and re.match(r'\|[ :|\-]+\|',lines[i].strip()):
            rows=[line];i+=1
            while i<len(lines) and lines[i].strip().startswith('|'):rows.append(lines[i].strip());i+=1
            out.append('<div class="tablewrap"><table>')
            for n,row in enumerate(rows):
                tag='th' if n==0 else 'td';out.append('<tr>'+''.join(f'<{tag}>{inline(c.strip())}</{tag}>' for c in row.strip('|').split('|'))+'</tr>')
            out.append('</table></div>');continue
        h=re.match(r'^(#{1,6})\s+(.+)',line)
        if h:out.append(f'<h{min(len(h[1])+1,6)}>{inline(h[2])}</h{min(len(h[1])+1,6)}>');continue
        if re.match(r'^[-*]\s',line):out.append('<p class="bullet">'+inline(line[2:].replace('[ ]','□').replace('[x]','☑'))+'</p>');continue
        numbered=re.match(r'^(\d+)[.)]\s+(.+)',line)
        if numbered:out.append('<p class="numbered"><span class="step-number">'+numbered[1]+'</span>'+inline(numbered[2])+'</p>');continue
        if line.startswith('>'):out.append('<blockquote>'+inline(line[1:].strip())+'</blockquote>');continue
        if re.fullmatch('[-*]{3,}',line):out.append('<hr>');continue
        if re.fullmatch(r'<!--.*?-->',line):continue
        out.append('<p>'+inline(line)+'</p>')
    return '\n'.join(out)

def plain(text):
    text=re.sub(r'<[^>]*>',' ',text)
    text=re.sub(r'\[([^]]+)\]\([^)]+\)',r'\1',text)
    return re.sub(r'\s+',' ',re.sub(r'[#*`|]',' ',text)).strip()

def anchor_start(text,position):
    """Include all immediately preceding explicit anchors with the next heading."""
    prefix=text[:position]
    m=re.search(r'(?:(?:^|\n)(?:[ \t]*<a id="[^"]+"></a>[ \t]*|[ \t]*))+\n?\Z',prefix)
    return m.start() if m and '<a id=' in m[0] else position

def summary(text):
    for line in text.splitlines():
        if not line.strip() or line.startswith(('#','<','|','-','*','[')):continue
        value=plain(line)
        if len(value)>18:return value[:115]+('…' if len(value)>115 else '')
    return ''

def create_data(source):
    manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
    chapters=[];aliases={};report={'countries':{},'unassigned_chapters':[],'duplicate_anchors':[]}
    countries=[]
    for country in manifest['countries']:
        code=country['code'];raw=(source/country['file']).read_text(encoding='utf-8')
        countries.append({k:country[k] for k in ('code','name','file','entries','chapters')})
        source_files=country['source_files'];parts=raw.split('<!-- SECTION -->')[1:]
        assert len(parts)==len(source_files),(code,len(parts),len(source_files))
        actual=0
        for index,part in enumerate(parts):
            title_match=re.search(r'^#\s+(.+)$',part,re.M)
            if not title_match:raise ValueError(f'Missing title {code}/{index}')
            title=title_match[1];all_ids=re.findall(r'<a id="([^"]+)"></a>',part)
            section_id=all_ids[0] if all_ids else code.lower()+'-'+str(index)
            source_file=source_files[index]
            is_chapter=source_file.startswith(('book/','guide/'))
            number=int(re.search(r'\d+',Path(source_file).stem)[0]) if is_chapter else None
            topic=next((topic for topic,nums in GROUPS[code].items() if number in nums),None) if is_chapter else ('arrival' if source_file=='CHINESE-READERS.md' else 'resources')
            if topic is None:topic='everyday';report['unassigned_chapters'].append(section_id)
            level=2 if code in ('US','AU') else 3
            if not is_chapter:level=2
            headings=list(re.finditer(r'^'+('#'*level)+r'\s+(.+)$',part,re.M))
            starts=[anchor_start(part,m.start()) for m in headings]
            intro=part[:starts[0]] if starts else part
            blocks=[part[start:starts[i+1] if i+1<len(starts) else len(part)] for i,start in enumerate(starts)]
            assert intro+''.join(blocks)==part,section_id+' content was lost'
            entries=[]
            for n,(heading,block) in enumerate(zip(headings,blocks)):
                ids=re.findall(r'<a id="([^"]+)"></a>',block)
                entry_id=ids[0] if ids else section_id+'-item-'+str(n+1)
                entries.append({'id':entry_id,'title':heading[1],'html':render(block),'text':plain(block),'summary':summary(block),'aliases':ids,'order':n+1})
                for alias in ids+[entry_id]:
                    if alias in aliases and aliases[alias]!=[section_id,entry_id]:report['duplicate_anchors'].append(alias)
                    aliases[alias]=[section_id,entry_id]
            for alias in re.findall(r'<a id="([^"]+)"></a>',intro)+[section_id]:
                if alias in aliases and aliases[alias]!=[section_id,None]:report['duplicate_anchors'].append(alias)
                aliases[alias]=[section_id,None]
            chapters.append({'id':section_id,'country':code,'title':title,'topic':topic,'number':number,'kind':'chapter' if is_chapter else 'guide' if source_file=='CHINESE-READERS.md' else 'resource','file':country['file'],'intro':render(intro),'introText':plain(intro),'entries':entries,'sourceFile':source_file,'sourceHash':hashlib.sha256(part.encode()).hexdigest()})
            if is_chapter:actual+=len(entries)
        report['countries'][code]={'expected_entries':country['entries'],'parsed_entries':actual,'sections':len(parts),'expected_chapters':country['chapters'],'parsed_chapters':sum(c['country']==code and c['kind']=='chapter' for c in chapters)}
        assert actual==country['entries'],(code,actual,country['entries'])
    assert not report['duplicate_anchors'],report['duplicate_anchors'][:10]
    # Optional country-specific practical manuals augment, never replace,
    # the complete original books. Each H2 question is its own readable item.
    depth_topics={'visa':'arrival','housing':'housing','work':'work','health':'health','tax':'money','travel':'travel'}
    report['depth_manuals']=[]
    for country in countries:
        code=country['code']
        for name,topic in depth_topics.items():
            path=HERE/'content'/code/(name+'.md')
            if not path.exists():path=source/(code+'-'+name+'.md')
            if not path.exists():continue
            part=path.read_text(encoding='utf-8-sig')
            title_match=re.search(r'^#\s+(.+)$',part,re.M)
            if not title_match:raise ValueError('Missing deep manual title: '+str(path))
            section_id=code.lower()+'-depth-'+name
            headings=list(re.finditer(r'^##\s+(.+)$',part,re.M))
            starts=[anchor_start(part,m.start()) for m in headings]
            intro=part[:starts[0]] if starts else part
            blocks=[part[start:starts[i+1] if i+1<len(starts) else len(part)] for i,start in enumerate(starts)]
            assert intro+''.join(blocks)==part
            entries=[]
            for n,(heading,block) in enumerate(zip(headings,blocks)):
                ids=re.findall(r'<a id="([^"]+)"></a>',block)
                entry_id=section_id+'-q'+str(n+1).zfill(2)
                entries.append({'id':entry_id,'title':heading[1],'html':'<a id="'+entry_id+'"></a>\n'+render(block),'text':plain(block),'summary':summary(block),'aliases':ids+[entry_id],'order':n+1})
                for alias in ids+[entry_id]:
                    if alias in aliases:raise ValueError('Duplicate deep manual anchor: '+alias)
                    aliases[alias]=[section_id,entry_id]
            for alias in re.findall(r'<a id="([^"]+)"></a>',intro)+[section_id]:
                if alias in aliases:raise ValueError('Duplicate deep manual anchor: '+alias)
                aliases[alias]=[section_id,None]
            filename=code+'-'+name+'.md'
            chapters.append({'id':section_id,'country':code,'title':title_match[1],'topic':topic,'number':None,'kind':'depth','file':filename,'intro':'<a id="'+section_id+'"></a>\n'+render(intro),'introText':plain(intro),'entries':entries,'sourceFile':filename,'sourceHash':hashlib.sha256(part.encode()).hexdigest()})
            report['depth_manuals'].append({'country':code,'file':filename,'questions':len(entries),'han_characters':len(re.findall('[\u3400-\u9fff]',part)),'anchor':section_id})
    return {'version':2,'countries':countries,'topics':TOPICS,'chapters':chapters,'aliases':aliases,'updated':manifest.get('translation_date','2026-10-09')},report

def build(source,out):
    out.mkdir(parents=True,exist_ok=True)
    data,report=create_data(source)
    template=(HERE/'reader-template.html').read_text(encoding='utf-8')
    template=template.replace('__DATA__',json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/'))
    template=template.replace('__CORE__',(HERE/'reader-core.js').read_text(encoding='utf-8'))
    template=template.replace('__APP__',(HERE/'reader-app.js').read_text(encoding='utf-8'))
    (out/'index.html').write_text(template,encoding='utf-8')
    for name in ('manifest.json','US.md','AU.md','KR.md','JP.md','README.md','ATTRIBUTION.md','TRANSLATION.md','LICENSE','LICENSE-CODE'):
        if (source/name).exists() and (source/name).resolve()!=(out/name).resolve():shutil.copy2(source/name,out/name)
    for name in ('social-preview.png','cover.svg'):
        if (source/name).exists() and (source/name).resolve()!=(out/name).resolve():shutil.copy2(source/name,out/name)
    for manual in report['depth_manuals']:
        name=manual['file'];origin=HERE/'content'/manual['country']/name.split('-',1)[1]
        if not origin.exists():origin=source/name
        if origin.resolve()!=(out/name).resolve():shutil.copy2(origin,out/name)
    (out/'reader-build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'.nojekyll').touch()
    print(json.dumps(report,ensure_ascii=False,indent=2))
    print('Built',out/'index.html')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=HERE);p.add_argument('--out',type=Path,default=HERE)
    args=p.parse_args();build(args.source.resolve(),args.out.resolve())
