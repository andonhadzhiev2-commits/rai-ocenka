/* РАЙ Оценка · интерактивни планове на реалните две зали */
(function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  // Coordinates transcribed from the owner-provided plans. px correspond to original sketch size.
  // Stored positions (if edited) supersede these initial suggestions; QR codes are never modified.
  const inside = [
    [21,340,0,94,154],[22,457,0,94,154],[23,573,0,95,154],[24,690,0,95,154],
    [42,982,0,100,92],[41,1130,0,136,92],[40,1327,0,97,92],
    [11,101,175,94,154],[12,220,175,94,154],[13,340,175,94,154],
    [17,54,374,94,154],[18,146,374,94,154],[19,302,374,93,154],
    [16,459,313,94,92],[28,563,313,138,92],[35,794,313,94,92],
    [31,646,497,94,100],[32,646,610,94,92],[33,646,756,94,92],[34,646,863,94,92],
    [36,794,497,94,92],[37,794,610,94,92],[38,794,756,94,92],[39,794,863,94,92],
    [43,998,251,67,93],[44,998,358,67,93],[45,998,465,67,92],[46,998,572,67,93],
    [61,998,715,67,93],[62,998,826,67,93],[63,998,900,67,92],
    [52,1270,348,154,94],[53,1301,485,92,92,'round'],[55,1301,618,92,92,'round'],
    [66,1301,751,92,92,'round'],[67,1266,900,155,93]
  ];
  const kids = [
    [91,114,30,69,108],[70,340,30,68,108],[71,563,30,69,108],[80,772,28,67,110],[81,990,28,67,110],
    [2,26,300,70,65],[3,148,300,70,65],[8,257,300,66,65],[72,402,303,116,67],
    [73,597,245,105,62],[82,791,245,105,62],[83,985,245,81,62],
    [4,25,426,77,68],[5,140,426,76,68],[9,247,426,75,68],
    [74,597,335,105,61],[84,791,335,105,61],[85,985,335,81,61],
    [93,1085,198,69,67],[90,1085,285,69,66],
    [6,25,557,77,70],[7,140,557,76,70],[10,247,557,75,70],
    [92,31,714,145,64],[75,512,584,95,75],[76,659,584,95,75],
    [86,820,584,95,75],[87,982,584,95,75],[88,941,710,95,112],[89,1079,710,76,112]
  ];
  const CONFIG = {
    inside:{title:'Вътрешна зала',w:1448,h:1024,seats:inside,
      svg:'<rect x="0" y="0" width="1448" height="1024" fill="#171a20"/>' +
      '<rect x="0" y="200" width="54" height="129" rx="4" fill="#363037" stroke="#806655"/><text x="27" y="278" text-anchor="middle" fill="#f2ddd0" font-size="18" transform="rotate(-90 27 278)">БАР</text>' +
      '<rect x="971" y="175" width="92" height="54" rx="4" fill="#30333a" stroke="#5f6470"/><text x="1017" y="209" text-anchor="middle" fill="#cbd1dd" font-size="21">ШКАФ</text>' +
      '<rect x="647" y="420" width="93" height="53" rx="4" fill="#30333a" stroke="#5f6470"/><text x="694" y="453" text-anchor="middle" fill="#cbd1dd" font-size="21">ШКАФ</text>' +
      '<rect x="1396" y="160" width="52" height="92" rx="3" fill="#214c3b" stroke="#48936b"/><text x="1427" y="232" text-anchor="middle" fill="#dafce3" font-size="21" transform="rotate(-90 1427 232)">ВХОД</text>' +
      '<rect x="718" y="966" width="92" height="58" rx="4" fill="#214c3b" stroke="#48936b"/><text x="764" y="1003" text-anchor="middle" fill="#dafce3" font-size="21">ВХОД</text>'},
    kids:{title:'Детски кът',w:1169,h:827,seats:kids,
      svg:'<rect x="0" y="0" width="1169" height="827" fill="#171a20"/>' +
      '<path d="M759 0 V180 H547 V386 H0 M0 385 H365 V543 H930 V410 H1072 V199 H1169" stroke="#707882" stroke-width="7" stroke-linejoin="round" fill="none"/>' +
      '<rect x="405" y="439" width="73" height="199" rx="4" fill="#333940" stroke="#626c79"/><text x="441" y="550" text-anchor="middle" fill="#d3dae4" font-size="19" transform="rotate(-90 441 550)">ШКАФ</text>' +
      '<rect x="936" y="468" width="200" height="69" rx="4" fill="#333940" stroke="#626c79"/><text x="1036" y="510" text-anchor="middle" fill="#d3dae4" font-size="23">ШКАФ</text>' +
      '<rect x="397" y="675" width="91" height="81" rx="5" fill="#242c35" stroke="#788394"/><text x="443" y="726" text-anchor="middle" fill="#d3dae4" font-size="22">PC</text>'}
  };
  const byNum = rows => new Map(rows.map(t => [String(t.label).trim(),t]));
  const mapName = (t) => {
    const n = Number(t.label);
    if (CONFIG.kids.seats.some(q => q[0] === n)) return 'kids';
    if (CONFIG.inside.seats.some(q => q[0] === n)) return 'inside';
    return /дет|дк|kids/i.test(t.zone_name||'') ? 'kids':'inside';
  };
  function mount(opt) {
    let zone='inside', period=opt.period||'mtd', from=opt.from||'',to=opt.to||'', mode='avg', selected=null, placing=null, edit=false, seq=0;
    let tables=[], aggregated=[], reviews=[];
    let showDetail=false;
    // Selection stores permanent zone:number keys, including not-yet-registered tables.
    const printSelection=new Set();
    let printing=false;
    function pdf(scope,numbers,filename) {
      if (printing) return;
      if (!window.RAIPdf) { opt.toast('PDF модулът липсва. Презареди страницата.');return; }
      if(scope==='selected' && !numbers.length){opt.toast('Избери маси върху схемата.');return;}
      printing=true;
      opt.toast('Подготвям QR PDF…');
      api('/tables/ensure-floorplan',{method:'POST',body:{scope:scope,numbers:numbers}})
        .then(function(result){
          // Only persistent existing/new IDs are used for QR, never new QR per print.
          const entries=result.tables;
          if(entries.some(t=>!t.active))throw new Error('Има спряна маса сред избраните. Активирай я в „Маси и зони“.');
          return window.RAIPdf.export(entries.map(t=>t.id),{filename:filename}).then(function(info){
            opt.toast('PDF изтеглен: '+info.count+' маси, '+info.pages+' страници');
            load();
          });
        }).catch(opt.fail).finally(function(){printing=false;});
    }
    const keyForNum=n=>(CONFIG.kids.seats.some(q=>q[0]===Number(n))?'kids':'inside')+':'+n;
    const target=opt.view, api=opt.api;
    if (target.__raiFloorplanHandler) target.removeEventListener('click',target.__raiFloorplanHandler);
    target.__raiFloorplanHandler=function(e){
      const m=e.target.closest('#fp-mark'),o=e.target.closest('#fp-one-pdf');if(!m&&!o)return;
      if(selected===null)return;
      if(m){const k=keyForNum(selected);if(printSelection.has(k))printSelection.delete(k);else printSelection.add(k);draw();}
      if(o)pdf('selected',[Number(selected)],'RAI_QR_masa_'+selected+'.pdf');
    };
    target.addEventListener('click',target.__raiFloorplanHandler);
    const fmt = n => n==null?'—':Number(n).toFixed(2);
    function params() {
      if(period==='custom' && from && to) return '?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to);
      return '?period='+(period==='custom'?'month':period);
    }
    function periodControls() {
      return '<div class="fp-controls"><div class="fp-pills" role="group" aria-label="Период">'+
        [['mtd','Този месец'],['day','Днес'],['week','7 дни'],['month','30 дни'],['all','Всичко'],['custom','Период']].map(x=>'<button type="button" class="fp-pill '+(period===x[0]?'on':'')+'" data-fpp="'+x[0]+'">'+x[1]+'</button>').join('')+
        '</div>'+ (period==='custom'?'<div class="fp-dates"><label>От <input id="fp-from" type="date" value="'+esc(from)+'"></label><label>До <input id="fp-to" type="date" value="'+esc(to)+'"></label><button type="button" class="btn small primary" id="fp-go">Покажи</button></div>':'')+'</div>';
    }
    function makeStage(){
      const c=CONFIG[zone], existing=byNum(tables.filter(t=>mapName(t)===zone));
      const marks=new Map(aggregated.map(x=>[Number(x.table_id),x]));
      let markup='<svg class="fp-sketch" viewBox="0 0 '+c.w+' '+c.h+'" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+c.svg+'</svg>';
      c.seats.forEach(spec=>{
        const [num,x,y,w,h,shape]=spec;const t=existing.get(String(num));
        const a=t?marks.get(Number(t.id)):null;
        const total=a?Number(a.total):0,avg=a?Number(a.avg_rating):null,low=a?Number(a.low_count):0;
        const quality=!t?'pending':!total?'neutral':avg<3.5?'bad':avg<4.3?'mixed':'good';
        const posX=t&&t.map_x!=null?Number(t.map_x):100*(x+w/2)/c.w;
        const posY=t&&t.map_y!=null?Number(t.map_y):100*(y+h/2)/c.h;
        const attr='style="left:'+posX+'%;top:'+posY+'%;width:'+(w/c.w*100)+'%;height:'+(h/c.h*100)+'%"';
        markup+='<button type="button" title="Маса '+esc(num)+' · '+(total?fmt(avg)+' звезди, '+total+' отзива':'Няма отзиви')+'" class="fp-seat '+quality+(shape==='round'?' round':'')+(selected===num?' selected':'')+(t&&printSelection.has(keyForNum(num))?' print-marked':'')+'" data-fps="'+esc(num)+'" '+attr+'><b>'+esc(num)+'</b>'+(total?'<small>'+fmt(avg)+' ★</small>':'')+'</button>';
      });
      const unplaced=tables.filter(t=>mapName(t)===zone&&!c.seats.some(q=>String(q[0])===String(t.label)));
      return '<div class="fp-map-scroll"><div class="fp-map" style="aspect-ratio:'+c.w+'/'+c.h+'">'+markup+'</div></div>'+
      (unplaced.length?'<div class="fp-extra"><b>Маси извън първоначалната скица:</b> '+unplaced.map(t=>'<button class="btn small" data-fpex="'+esc(t.label)+'">'+esc(t.label)+'</button>').join(' ')+'</div>':'');
    }
    function detail() {
      if(selected===null)return '<div class="fp-empty"><b>Избери маса от скицата</b><p>Ще видиш средната оценка, оплакванията и часовете на получените отзиви за избрания период.</p></div>';
      const t=tables.find(t=>String(t.label)===String(selected)&&mapName(t)===zone);
      if(!t)return opt.embedded ? '<div class="fp-empty"><b>Маса '+esc(selected)+'</b><p>За тази маса все още няма регистриран QR код и няма отзиви. Можеш да я добавиш от „Управление“.</p></div>' : '<div class="fp-empty"><b>Маса '+esc(selected)+'</b><p>При първия печат ще се запише постоянен индивидуален QR код за масата.</p><button type="button" class="btn small primary" id="fp-one-pdf">Изтегли QR PDF</button><button type="button" class="btn small" id="fp-mark">'+(printSelection.has(keyForNum(selected))?'☑ Маркирана':'☐ Маркирай за печат')+'</button></div>';
      const a=aggregated.find(a=>Number(a.table_id)===Number(t.id));
      return '<div class="fp-detail-head"><div><h2>Маса '+esc(t.label)+'</h2><div class="meta">'+esc(t.zone_name||CONFIG[zone].title)+'</div></div>'+(opt.embedded?'':'<a class="btn small" href="#/print/'+t.id+'">QR / Лепенка</a>')+'</div>'+
        (opt.embedded?'':'<div class="fp-print-choices"><button type="button" class="btn small" id="fp-mark">'+(printSelection.has(keyForNum(t.label))?'☑ Маркирана за печат':'☐ Маркирай за печат')+'</button><button type="button" class="btn small primary" id="fp-one-pdf">Изтегли QR PDF</button></div>')+
        '<div class="fp-mini-stats"><div><b>'+fmt(a&&a.avg_rating)+' ★</b><small>Средна оценка</small></div><div><b>'+Number(a&&a.total||0)+'</b><small>Всички отзиви</small></div><div><b>'+Number(a&&a.low_count||0)+'</b><small>Ниски 1–3★</small></div></div>'+
        '<p class="meta">Показани са реалните оценки за избрания период. Малък брой отзиви не е достатъчен за категоричен извод.</p>'+
        (reviews.length?'<h3>Последни отзиви</h3>'+reviews.slice(0,12).map(r=>'<a href="#/review/'+esc(r.id)+'" class="fp-review"><span><b>'+r.rating+' ★</b> · '+new Date(r.created_at).toLocaleString('bg-BG',{timeZone:'Europe/Sofia',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'</span>'+(r.comment?'<p>'+esc(r.comment)+'</p>':'')+(Array.isArray(r.tags)&&r.tags.length?'<small>'+r.tags.map(x=>esc((opt.tags||{})[x]||x)).join(' · ')+'</small>':'')+'</a>').join(''):'<p class="muted">Няма отзиви за този период.</p>')+
        (edit?'<p class="meta">Режим редакция: избери маса и после натисни място върху схемата, за да я преместиш.</p>':'');
    }
    function draw() {
      const c=CONFIG[zone], selectedStats=aggregated.filter(a=>tables.some(t=>t.id===Number(a.table_id)&&mapName(t)===zone));
      const reviewsCount=selectedStats.reduce((n,a)=>n+Number(a.total),0);
      const low=selectedStats.reduce((n,a)=>n+Number(a.low_count),0);
      const weight=selectedStats.reduce((n,a)=>n+Number(a.avg_rating)*Number(a.total),0);
      target.innerHTML=(opt.embedded ? '' : '<a href="#/stats" class="muted">← Анализи</a><div class="row between"><div><h1>Анализ по маси</h1><p class="muted">Интерактивна схема по реалното разположение на масите</p></div><button class="btn small" id="fp-refresh">Обнови</button></div>')+
        periodControls()+
        (opt.embedded ? '' : '<div class="fp-print-toolbar"><span><b>'+printSelection.size+'</b> маси за печат</span><button type="button" class="btn small primary" id="fp-pdf-selected">Изтегли избраните PDF</button><button type="button" class="btn small" id="fp-pdf-zone">Цялата зала PDF</button><button type="button" class="btn small" id="fp-pdf-all">Всички маси PDF</button><button type="button" class="btn small" id="fp-print-clear">Изчисти</button></div>')+
        '<div class="fp-kpis"><div><span>Отзиви за залата</span><b>'+reviewsCount+'</b></div><div><span>Средна оценка</span><b>'+(reviewsCount?(weight/reviewsCount).toFixed(2):'—')+' ★</b></div><div><span>Ниски оценки</span><b>'+low+'</b></div></div>'+
        '<div class="fp-layout"><section class="fp-left"><div class="fp-map-head"><div class="fp-map-heading"><div class="fp-zone-switch" role="group" aria-label="Избор на зала">'+[['inside','Вътрешна зала'],['kids','Детски кът']].map(x=>'<button type="button" class="fp-zone-tab'+(zone===x[0]?' on':'')+'" aria-pressed="'+(zone===x[0])+'" data-fpz="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><span>Натисни маса, за да видиш подробности</span></div>'+(opt.embedded?'':'<button type="button" class="btn small" id="fp-edit">'+(edit?'Готово':'Подреди маси')+'</button>')+'</div>'+
        makeStage()+
        '<div class="fp-legend"><span><i class="fp-dot good"></i>Добри</span><span><i class="fp-dot mixed"></i>Смесени</span><span><i class="fp-dot bad"></i>Проблемни</span><span><i class="fp-dot neutral"></i>Без отзиви</span></div>'+
        '<p class="meta">Цветовете се определят от средната оценка още от първия отзив. Броят отзиви показва колко данни има за масата.</p></section>'+
        (opt.embedded ? '' : '<aside class="fp-right" id="fp-detail">'+detail()+'</aside>')+'</div>'+
        (opt.embedded && showDetail ? '<div class="fp-modal-backdrop" id="fp-modal-backdrop" role="presentation"><section class="fp-modal" role="dialog" aria-modal="true" aria-label="Отзиви за маса '+esc(selected)+'"><button type="button" class="fp-modal-close" id="fp-modal-close" aria-label="Затвори">✕</button><div id="fp-modal-body">'+detail()+'</div></section></div>' : '');
      target.querySelectorAll('[data-fpz]').forEach(b=>b.onclick=()=>{zone=b.dataset.fpz;selected=null;showDetail=false;reviews=[];draw();});
      target.querySelectorAll('[data-fpp]').forEach(b=>b.onclick=()=>{period=b.dataset.fpp;selected=null;showDetail=false;reviews=[];if(period==='custom')draw();else load();});
      const go=target.querySelector('#fp-go');if(go)go.onclick=()=>{from=target.querySelector('#fp-from').value;to=target.querySelector('#fp-to').value;if(!from||!to||from>to){opt.toast('Избери валиден период');return;}selected=null;showDetail=false;reviews=[];load();};
      if(target.querySelector('#fp-refresh')) target.querySelector('#fp-refresh').onclick=()=>load();
      if(target.querySelector('#fp-pdf-selected')) target.querySelector('#fp-pdf-selected').onclick=()=>pdf('selected',[...printSelection].map(k=>Number(k.split(':')[1])),'RAI_QR_izbrani_masi.pdf');
      if(target.querySelector('#fp-pdf-zone')) target.querySelector('#fp-pdf-zone').onclick=()=>pdf(zone,CONFIG[zone].seats.map(q=>q[0]),'RAI_QR_'+(zone==='kids'?'detski_kat':'vatreshna_zala')+'.pdf');
      if(target.querySelector('#fp-pdf-all')) target.querySelector('#fp-pdf-all').onclick=()=>pdf('all',[],'RAI_QR_vsichki_masi.pdf');
      if(target.querySelector('#fp-print-clear')) target.querySelector('#fp-print-clear').onclick=()=>{printSelection.clear();draw();};
      const editBtn=target.querySelector('#fp-edit');if(editBtn)editBtn.onclick=()=>{edit=!edit;placing=null;draw();};
      const closeModal=()=>{showDetail=false;draw();};
      const closeBtn=target.querySelector('#fp-modal-close');if(closeBtn)closeBtn.onclick=closeModal;
      const backdrop=target.querySelector('#fp-modal-backdrop');if(backdrop)backdrop.onclick=e=>{if(e.target===backdrop)closeModal();};
      target.querySelectorAll('[data-fps],[data-fpex]').forEach(b=>b.onclick=()=>{const num=Number(b.dataset.fps||b.dataset.fpex);selected=num;placing=edit?num:null;showDetail=!!opt.embedded;reviews=[];draw();const t=tables.find(x=>String(x.label)===String(num)&&mapName(x)===zone);if(t)loadReviews(t.id);});
      const map=target.querySelector('.fp-map');
      if(edit)map.onclick=e=>{
        if(e.target.closest('.fp-seat'))return;
        if(placing===null){opt.toast('Първо избери маса');return;}
        const t=tables.find(x=>String(x.label)===String(placing)&&mapName(x)===zone);
        if(!t){opt.toast('Първо добави масата в Управление');return;}
        const rect=map.getBoundingClientRect();
        const px=Math.max(2,Math.min(98,100*(e.clientX-rect.left)/rect.width));
        const py=Math.max(2,Math.min(98,100*(e.clientY-rect.top)/rect.height));
        api('/tables/'+t.id+'/position',{method:'PATCH',body:{x:Math.round(px*100)/100,y:Math.round(py*100)/100}})
          .then(()=>{t.map_x=px;t.map_y=py;opt.toast('Маса '+t.label+' е преместена. QR кодът не е променен.');draw();}).catch(opt.fail);
      };
    }
    function loadReviews(id){
      const current=++seq;
      api('/reviews'+params()+(params().includes('?')?'&':'?')+'table='+id+'&limit=200')
        .then(rows=>{if(current!==seq)return;reviews=rows;const d=target.querySelector(opt.embedded?'#fp-modal-body':'#fp-detail');if(d)d.innerHTML=detail();}).catch(opt.fail);
    }
    function load(){
      const q=params();
      return Promise.all([api('/tables'),api('/floorplan/stats'+q)])
        .then(x=>{tables=x[0];aggregated=x[1];reviews=[];draw();
          const t=tables.find(t=>String(t.label)===String(selected)&&mapName(t)===zone);
          if(t)loadReviews(t.id);}).catch(opt.fail);
    }
    return load();
  }
  window.RAIFloorplan={mount:mount};
})();