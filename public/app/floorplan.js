/* РАЙ Оценка · интерактивни планове на реалните две зали */
(function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  // Coordinates transcribed from the owner-provided plans. px correspond to original sketch size.
  // Stored positions (if edited) supersede these initial suggestions; QR codes are never modified.
  // Spacious owner overview: preserve table identifiers and grouping, but give
  // the score stars room to breathe. Separately-positioned tables remain clickable.
  const inside = [
    [21,295,35,118,105],[22,455,35,118,105],[23,615,35,118,105],[24,775,35,118,105],
    [42,995,35,118,105],[41,1190,35,130,105],[40,1405,35,118,105],
    [11,75,220,118,105],[12,235,220,118,105],[13,395,220,118,105],
    [17,75,415,118,105],[18,235,415,118,105],[19,395,415,118,105],
    [16,555,415,118,105],[28,715,415,118,105],[35,875,415,118,105],
    [31,715,630,118,105],[32,715,825,118,105],[33,715,1020,118,105],[34,715,1215,118,105],
    [36,895,630,118,105],[37,895,825,118,105],[38,895,1020,118,105],[39,895,1215,118,105],
    [43,1085,255,118,105],[44,1085,440,118,105],[45,1085,625,118,105],[46,1085,810,118,105],
    [61,1085,995,118,105],[62,1085,1180,118,105],[63,1085,1365,118,105],
    [52,1350,320,130,105],[53,1350,520,118,105,'round'],[55,1350,720,118,105,'round'],
    [66,1350,920,118,105,'round'],[67,1350,1120,130,105]
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
  // Clean interactive seating overview: only actual tables, no furniture/entrance clutter.
  // Preserve all seat coordinates, table numbering and saved custom positions.
  const CONFIG = {
    inside:{title:'Вътрешна зала',w:1600,h:1540,seats:inside},
    kids:{title:'Детски кът',w:1169,h:827,seats:kids}
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
    let tables=[], aggregated=[], reviews=[], venueRating=null;
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
      if(o){
        const chosen=[...printSelection].map(k=>Number(k.split(':')[1]));
        const numbers=chosen.length?chosen:[Number(selected)];
        pdf('selected',numbers,numbers.length===1?'RAI_QR_masa_'+numbers[0]+'.pdf':'RAI_QR_'+numbers.length+'_izbrani_masi.pdf');
      }
    };
    target.addEventListener('click',target.__raiFloorplanHandler);
    const fmt = n => n==null?'—':Number(n).toFixed(2);
    function params() {
      if(period==='custom' && from && to) return '?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to);
      return '?period='+(period==='custom'?'month':period);
    }
    function periodControls() {
      return '<div class="fp-controls"><div class="fp-pills" role="group" aria-label="Период">'+
        [['day','Ден'],['week','Седмица'],['mtd','Месец'],['custom','Период']].map(x=>'<button type="button" class="fp-pill '+(period===x[0]?'on':'')+'" data-fpp="'+x[0]+'">'+x[1]+'</button>').join('')+
        '</div>'+ (period==='custom'?'<div class="fp-dates"><label>От <input id="fp-from" type="date" value="'+esc(from)+'"></label><label>До <input id="fp-to" type="date" value="'+esc(to)+'"></label><button type="button" class="btn small primary" id="fp-go">Покажи</button></div>':'')+'</div>';
    }
    function makeStage(){
      const c=CONFIG[zone], existing=byNum(tables.filter(t=>mapName(t)===zone));
      const marks=new Map(aggregated.map(x=>[Number(x.table_id),x]));
      let markup='';
      c.seats.forEach(spec=>{
        const [num,x,y,w,h]=spec;const t=existing.get(String(num));
        const a=t?marks.get(Number(t.id)):null;
        const total=a?Number(a.total):0,avg=a?Number(a.avg_rating):null,low=a?Number(a.low_count):0;
        const quality=!t?'pending':!total?'neutral':avg<3.5?'bad':avg<4.3?'mixed':'good';
        const posX=t&&t.map_x!=null?Number(t.map_x):100*(x+w/2)/c.w;
        const posY=t&&t.map_y!=null?Number(t.map_y):100*(y+h/2)/c.h;
        const attr='style="left:'+posX+'%;top:'+posY+'%"';
        markup+='<button type="button" title="Маса '+esc(num)+' · '+(total?fmt(avg)+' звезди, '+total+' отзива':'Няма отзиви')+'" class="fp-seat '+quality+(selected===num?' selected':'')+(printSelection.has(keyForNum(num))?' print-marked':'')+'" data-fps="'+esc(num)+'" '+attr+'><b>'+esc(num)+'</b>'+(total?'<small class="rai-seat-stars" aria-label="Средна оценка '+fmt(avg)+' от 5">'+'★'.repeat(Math.max(1,Math.min(5,Math.round(Number(avg)||0))))+'</small>':'')+'</button>';
      });
      const unplaced=tables.filter(t=>mapName(t)===zone&&!c.seats.some(q=>String(q[0])===String(t.label)));
      return '<div class="fp-map-scroll"><div class="fp-map fp-map-'+zone+'" style="aspect-ratio:'+c.w+'/'+c.h+'">'+markup+'</div></div>'+
      (unplaced.length?'<div class="fp-extra"><b>Маси извън първоначалната скица:</b> '+unplaced.map(t=>'<button class="btn small" data-fpex="'+esc(t.label)+'">'+esc(t.label)+'</button>').join(' ')+'</div>':'');
    }
    function detail() {
      if(selected===null)return '<div class="fp-empty"><b>Избери маса от скицата</b><p>Ще видиш средната оценка, оплакванията и часовете на получените отзиви за избрания период.</p></div>';
      const t=tables.find(t=>String(t.label)===String(selected)&&mapName(t)===zone);
      if(!t)return opt.embedded ? '<div class="fp-empty"><b>Маса '+esc(selected)+'</b><p>За тази маса все още няма регистриран QR код и няма отзиви. Можеш да я добавиш от „Управление“.</p></div>' : '<div class="fp-empty"><b>Маса '+esc(selected)+'</b><p>При първия печат ще се запише постоянен индивидуален QR код за масата.</p><button type="button" class="btn small primary" id="fp-one-pdf">'+(printSelection.size>1?'Изтегли '+printSelection.size+' избрани PDF':printSelection.size===1?'Изтегли маркираната маса PDF':'Изтегли QR PDF')+'</button><button type="button" class="btn small" id="fp-mark">'+(printSelection.has(keyForNum(selected))?'☑ Маркирана':'☐ Маркирай за печат')+'</button></div>';
      const a=aggregated.find(a=>Number(a.table_id)===Number(t.id));
      return '<div class="fp-detail-head"><div><h2>Маса '+esc(t.label)+'</h2><div class="meta">'+esc(t.zone_name||CONFIG[zone].title)+'</div></div>'+(opt.embedded?'':'<a class="btn small" href="#/print/'+t.id+'">QR / Лепенка</a>')+'</div>'+
        (opt.embedded?'':'<div class="fp-print-choices"><button type="button" class="btn small" id="fp-mark">'+(printSelection.has(keyForNum(t.label))?'☑ Маркирана за печат':'☐ Маркирай за печат')+'</button><button type="button" class="btn small primary" id="fp-one-pdf">'+(printSelection.size>1?'Изтегли '+printSelection.size+' избрани PDF':printSelection.size===1?'Изтегли маркираната маса PDF':'Изтегли QR PDF')+'</button></div>')+
        '<div class="fp-mini-stats"><div><b class="fp-average-stars" aria-label="Средна оценка '+fmt(a&&a.avg_rating)+' от 5">'+(a&&a.total&&a.avg_rating!=null?'★'.repeat(Math.max(1,Math.min(5,Math.round(Number(a.avg_rating))))):'—')+'</b><small>Средна оценка</small></div><div><b>'+Number(a&&a.total||0)+'</b><small>Всички отзиви</small></div><div><b>'+Number(a&&a.low_count||0)+'</b><small>Ниски 1–3★</small></div></div>'+
        (reviews.length?'<h3>Последни отзиви</h3>'+reviews.slice(0,12).map(r=>'<a href="#/review/'+esc(r.id)+'" class="fp-review"><span><b><span class="rai-review-stars" aria-label="'+Number(r.rating)+' от 5 звезди">'+('★'.repeat(Math.max(0,Math.min(5,Number(r.rating)||0))))+'</span></b> · '+new Date(r.created_at).toLocaleDateString('bg-BG',{timeZone:'Europe/Sofia',day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\s*г\.?$/,'')+' г., '+new Date(r.created_at).toLocaleTimeString('bg-BG',{timeZone:'Europe/Sofia',hour:'2-digit',minute:'2-digit',hour12:false})+' ч.'+'</span>'+(r.comment?'<p>'+esc(r.comment)+'</p>':'')+(Array.isArray(r.tags)&&r.tags.length?'<small>'+r.tags.map(x=>esc((opt.tags||{})[x]||x)).join(' · ')+'</small>':'')+'</a>').join(''):'<p class="muted">Няма отзиви за този период.</p>')+
        (edit?'<p class="meta">Режим редакция: избери маса и после натисни място върху схемата, за да я преместиш.</p>':'');
    }
    function draw() {
      const c=CONFIG[zone], selectedStats=aggregated.filter(a=>tables.some(t=>t.id===Number(a.table_id)&&mapName(t)===zone));
      const reviewsCount=selectedStats.reduce((n,a)=>n+Number(a.total),0);
      const low=selectedStats.reduce((n,a)=>n+Number(a.low_count),0);
      target.innerHTML=(opt.embedded ? '' : '<a href="#/stats" class="muted">← Отзиви</a><div class="row between"><div><h1>Анализ по маси</h1><p class="muted">Интерактивна схема по реалното разположение на масите</p></div><button class="btn small" id="fp-refresh">Обнови</button></div>')+
        (opt.embedded ? '' : periodControls())+
        (opt.embedded ? '' : '<div class="fp-print-toolbar"><span><b>'+printSelection.size+'</b> маси за печат</span><button type="button" class="btn small primary" id="fp-pdf-selected">Изтегли избраните PDF</button><button type="button" class="btn small" id="fp-pdf-zone">Цялата зала PDF</button><button type="button" class="btn small" id="fp-pdf-all">Всички маси PDF</button><button type="button" class="btn small" id="fp-print-clear">Изчисти</button></div>')+
        (opt.embedded ? '' : '<div class="fp-kpis"><div><span>Отзиви за залата</span><b>'+reviewsCount+'</b></div><div><span>Обща оценка на РАЙ</span><b>'+fmt(venueRating)+' <span class="rai-gold-star">★</span></b></div><div><span>Ниски оценки</span><b>'+low+'</b></div></div>')+
        '<div class="fp-layout"><section class="fp-left"><div class="fp-map-head"><div class="fp-map-heading"><div class="fp-zone-switch" role="group" aria-label="Избор на зала">'+[['inside','Вътрешна зала'],['kids','Детски кът']].map(x=>'<button type="button" class="fp-zone-tab'+(zone===x[0]?' on':'')+'" aria-pressed="'+(zone===x[0])+'" data-fpz="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'+(opt.embedded?'':'<span>Натисни масите, които искаш да включиш в PDF</span>')+'</div>'+(opt.embedded?'':'<button type="button" class="btn small" id="fp-edit">'+(edit?'Готово':'Подреди маси')+'</button>')+'</div>'+
        makeStage()+
        '<div class="fp-legend"><span><i class="fp-dot good"></i>Добри</span><span><i class="fp-dot mixed"></i>Смесени</span><span><i class="fp-dot bad"></i>Проблемни</span><span><i class="fp-dot neutral"></i>Без отзиви</span></div>'+
        '</section>'+
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
      target.querySelectorAll('[data-fps],[data-fpex]').forEach(b=>b.onclick=()=>{const num=Number(b.dataset.fps||b.dataset.fpex);selected=num;placing=edit?num:null;showDetail=!!opt.embedded;if(!opt.embedded&&!edit){const key=keyForNum(num);if(printSelection.has(key))printSelection.delete(key);else printSelection.add(key);}reviews=[];draw();const t=tables.find(x=>String(x.label)===String(num)&&mapName(x)===zone);if(t)loadReviews(t.id);});
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
      return Promise.all([api('/tables'),api('/floorplan/stats'+q),api('/stats'+q)])
        .then(x=>{tables=x[0];aggregated=x[1];venueRating=x[2].avg;reviews=[];draw();
          const t=tables.find(t=>String(t.label)===String(selected)&&mapName(t)===zone);
          if(t)loadReviews(t.id);}).catch(opt.fail);
    }
    return load();
  }
  window.RAIFloorplan={mount:mount};
})();