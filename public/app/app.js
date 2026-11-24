/* РАЙ Оценка – приложение за собственик и управители (PWA) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view');
  var me = null;
  var refreshTimer = null;
  var TAGS = {
  "slow": "Забавено обслужване",
  "cold": "Храната беше студена",
  "wrong": "Объркана поръчка",
  "price": "Високи цени",
  "clean": "Недостатъчна чистота",
  "noise": "Прекалено шумно",
  "quality": "Качество на храната",
  "attitude": "Невнимателно отношение",
  "food": "Вкусна храна",
  "drinks": "Хубави напитки",
  "staff": "Любезно обслужване",
  "atmosphere": "Приятна атмосфера",
  "music": "Музиката",
  "value": "Добро съотношение цена–качество",
  "slow_order": "Чаках да вземат поръчката",
  "slow_food": "Чаках храната",
  "slow_drinks": "Чаках напитките",
  "slow_bill": "Чаках сметката",
  "cold_arrived": "Храната пристигна студена",
  "wrong_item": "Донесоха грешен продукт",
  "wrong_missing": "Липсваше част от поръчката",
  "price_food": "Храната е скъпа",
  "price_drinks": "Напитките са скъпи",
  "price_value": "Цената не отговаря на качеството",
  "clean_table": "Масата не беше почистена",
  "clean_dishes": "Чаши или прибори",
  "clean_wc": "Тоалетните",
  "clean_area": "Около масата",
  "noise_music": "Музиката беше силна",
  "noise_guests": "Шум от други клиенти",
  "noise_kids": "Шум от детския кът",
  "quality_taste": "Вкусът не ми хареса",
  "quality_cooking": "Не беше добре приготвена",
  "quality_portion": "Порцията не отговаряше на очакванията",
  "attitude_rude": "Нелюбезно отношение",
  "attitude_ignored": "Не ни обърнаха внимание",
  "attitude_help": "Не получих съдействие"
};
  var STATUS = { new: 'Нов', acknowledged: 'Поет', resolved: 'Разрешен' };
  var LANG = { bg: 'BG', en: 'EN', el: 'GR' };

  function esc(s) { return s == null ? '' : String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function stars(n) { var s = ''; for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '<span class="off">★</span>'; return '<span class="stars" aria-label="' + n + ' звезди">' + s + '</span>'; }
  function dt(d) { return new Date(d).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function tm(d) { return new Date(d).toLocaleTimeString('bg-BG', { timeZone: 'Europe/Sofia', hour: '2-digit', minute: '2-digit' }); }
  function place(r) { return [r.zone_name, r.table_label ? 'Маса ' + r.table_label : null].filter(Boolean).join(' · ') || 'Без маса'; }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2600); }
  function isOwner() { return me && me.role === 'owner'; }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch('/api/admin' + path, init).then(function (r) {
      var ct = r.headers.get('content-type') || '';
      var p = ct.indexOf('json') >= 0 ? r.json() : r.text();
      return p.then(function (data) {
        if (r.status === 401 && path !== '/auth/login') { me = null; location.hash = '#/login'; throw new Error('Необходим е вход.'); }
        if (!r.ok) throw new Error((data && data.error) || 'Грешка ' + r.status);
        return data;
      });
    });
  }
  function fail(e) { toast(e.message || String(e)); }

  // Read-only quick list, paginated across every zone; reviews stay unmodified.
  function openNewReviewsQuick(opts) {
    opts=opts||{};var onlyNew=opts.kind==='new',onlyComments=opts.kind==='comments',rating=Number(opts.rating)||0,limit=100,offset=0,busy=false,closed=false;
    var old=document.getElementById('rai-quick-backdrop');if(old)old.remove();
    var panel=document.createElement('div');panel.id='rai-quick-backdrop';panel.className='rai-quick-backdrop';
    var title=onlyNew?'Нови отзиви':onlyComments?'Коментари за периода':rating?'Оценки с '+rating+' звезди':'Всички оценки и отзиви';
    panel.innerHTML='<section class="rai-quick-panel" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="rai-quick-head"><div><div class="rai-eyebrow">РАЙ · Всички маси</div><h2>'+esc(title)+'</h2><p class="meta">Натисни оценка, за да видиш подробностите</p></div><button type="button" class="rai-quick-close" aria-label="Затвори">✕</button></div><div class="rai-quick-list" id="rai-quick-list"><p class="muted">Зареждане…</p></div><div class="rai-quick-footer"><span id="rai-quick-count"></span><button class="btn small" id="rai-quick-more" type="button" hidden>Зареди още</button></div></section>';
    document.body.appendChild(panel);
    function close(){closed=true;panel.remove();document.removeEventListener('keydown',key);}
    function key(e){if(e.key==='Escape')close();}
    document.addEventListener('keydown',key);
    panel.onclick=function(e){if(e.target===panel||e.target.closest('.rai-quick-close'))close();};
    var list=panel.querySelector('#rai-quick-list'),more=panel.querySelector('#rai-quick-more'),count=panel.querySelector('#rai-quick-count');
    function load(){
      if(busy||closed)return;busy=true;more.disabled=true;
      var q='/reviews?limit='+limit+'&offset='+offset+'&period='+encodeURIComponent(onlyNew?'all':opts.period||'all');
      if(onlyNew)q+='&status=new';if(onlyComments)q+='&with_comment=1';if(rating)q+='&rating='+rating;
      if(!onlyNew&&opts.period==='custom'&&opts.from)q='/reviews?limit='+limit+'&offset='+offset+'&from='+encodeURIComponent(opts.from)+'&to='+encodeURIComponent(opts.to||opts.from)+(rating?'&rating='+rating:'')+(onlyComments?'&with_comment=1':'');
      api(q).then(function(rows){
        if(closed)return;if(offset===0)list.innerHTML='';
        if(!rows.length&&!offset)list.innerHTML='<p class="rai-quick-empty">'+(onlyComments?'Няма коментари за избрания период.':'Няма оценки за този избор.')+'</p>';
        list.insertAdjacentHTML('beforeend',rows.map(function(r){return '<a class="rai-quick-review'+(r.rating<=3?' is-low':'')+'" href="#/review/'+esc(r.id)+'"><div class="rai-quick-review-top">'+stars(r.rating)+'<span class="rai-quick-date">'+dt(r.created_at)+'</span></div><strong>'+esc(place(r))+'</strong><p>'+esc(r.comment||'Без коментар')+'</p>'+(r.tags&&r.tags.length?'<small>'+esc(r.tags.map(function(t){return TAGS[t]||t;}).join(' · '))+'</small>':'')+'<span class="rai-quick-open">Отвори отзива ›</span></a>';}).join(''));
        list.querySelectorAll('a:not([data-wired])').forEach(function(a){a.dataset.wired='1';a.addEventListener('click',close);});
        offset+=rows.length;count.textContent='Показани '+offset;more.hidden=rows.length<limit;
      }).catch(function(e){list.insertAdjacentHTML('beforeend','<p class="muted">'+esc(e.message||e)+'</p>');}).finally(function(){busy=false;more.disabled=false;});
    }
    more.onclick=load;load();
  }

  // ---------- router ----------
  var routes = [];
  function route(re, fn) { routes.push([re, fn]); }
  function go() {
    clearInterval(refreshTimer);
    var h = location.hash.replace(/^#/, '') || '/stats';
    if (!me && h !== '/login') { location.hash = '#/login'; return; }
    for (var i = 0; i < routes.length; i++) {
      var m = h.match(routes[i][0]);
      if (m) {
        var tab = h === '/' || h.indexOf('/review') === 0 ? 'feed' : h.indexOf('/stats') === 0 ? 'stats' : h.indexOf('/me') === 0 ? 'me' : 'manage';
        document.querySelectorAll('.tabs a').forEach(function (a) { a.classList.toggle('on', a.dataset.tab === tab); });
        window.scrollTo(0, 0);
        return Promise.resolve(routes[i][1].apply(null, m.slice(1))).catch(fail);
      }
    }
    location.hash = '#/stats';
  }
  window.addEventListener('hashchange', go);
  function chrome(on) {
    $('#top').hidden = !on; $('#tabs').hidden = !on;
    document.querySelectorAll('.owner-only').forEach(function (e) { e.hidden = !isOwner(); });
  }
  var quickBadge = $('#openBadge');
  if (quickBadge) { quickBadge.setAttribute('role','button'); quickBadge.tabIndex=0; quickBadge.title='Покажи новите отзиви'; quickBadge.onclick=function(){openNewReviewsQuick({kind:'new'});}; quickBadge.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openNewReviewsQuick({kind:'new'});}}; }
  function updateBadge() {
    if (!me) return;
    api('/stats?period=day').then(function (s) {
      var b = $('#openBadge'), n = s.open.alerts || 0, repeats = isOwner() ? (s.open.repeated || 0) : 0;
      b.hidden = !n && !repeats;
      b.textContent = [repeats ? repeats + (repeats === 1 ? ' с история' : ' с история') : '', n ? n + (n === 1 ? ' ниска' : ' ниски') : ''].filter(Boolean).join(' · ');
      if (navigator.setAppBadge) { var total = n + repeats; if (total) navigator.setAppBadge(total).catch(function () {}); else navigator.clearAppBadge().catch(function () {}); }
    }).catch(function () {});
  }

  // ---------- login ----------
  route(/^\/login$/, function () {
    chrome(false);
    view.innerHTML = '<form class="login" id="lf"><img src="/app/logo.png" alt="Рай"><h1 style="text-align:center">РАЙ Оценка</h1>' +
      '<label class="f">Имейл<input id="le" type="email" autocomplete="username" required></label>' +
      '<label class="f">Парола<input id="lp" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn primary block" type="submit">Вход</button><p class="muted" id="lerr" role="alert"></p></form>';
    $('#lf').onsubmit = function (e) {
      e.preventDefault();
      api('/auth/login', { method: 'POST', body: { email: $('#le').value, password: $('#lp').value } })
        .then(loadMe).then(function () { location.hash = '#/stats'; })
        .catch(function (err) { $('#lerr').textContent = err.message; });
    };
  });

  // ---------- review feed: independent status, period and score filters ----------
  var feedFilter='all', feedPeriod='week', feedRatingSort='desc';
  function reviewCard(r) {
    var alert = r.rating <= (window.__alertMax || 2);
    return '<a class="rv ' + (alert ? 'alert' : 'r' + r.rating) + '" href="#/review/' + r.id + '">' +
      '<div class="row between"><span>' + stars(r.rating) + '</span><span class="pill ' + r.status + '">' + STATUS[r.status] + '</span></div>' +
      '<div class="meta">' + esc(place(r)) + ' · ' + dt(r.created_at) + ' · ' + (LANG[r.lang] || '') + '</div>' +
      (r.phone ? '<div class="tags"><span class="tag" style="border-color:#a97945;color:#ffe2a4">☎ Иска обаждане</span></div>' : '') +
      (r.prior_count > 0 ? '<div class="tags"><span class="tag" style="border-color:#a97945;color:#ffe2a4">↻ Оценка №'+(r.prior_count+1)+' · предишна '+r.previous_rating+'★</span></div>' : '') +
      (r.suspected_repeat && /10 часа|48 часа/.test(r.suspicion_reason || '') ? '<div class="tags"><span class="tag" style="border-color:#d68b43;color:#ffd7a3">⚠ Чести оценки · за проверка</span></div>' : '') +
      (isOwner() ? '<div class="meta">Браузър: '+(r.browser_short_id ? esc(r.browser_short_id) : 'няма идентификатор')+'</div>' : '') +
      (r.tags && r.tags.length ? '<div class="tags">' + r.tags.map(function (t) { return '<span class="tag">' + esc(TAGS[t] || t) + '</span>'; }).join('') + '</div>' : '') +
      (r.comment ? '<div class="comment">' + esc(r.comment) + '</div>' : '') + '</a>';
  }
  route(/^\/$/, function () {
    chrome(true);
    var showBrowserRegistry = false;
    function draw() {
      var q='/reviews?period='+feedPeriod+'&limit=200';
      if(feedFilter==='new')q+='&status=new';
      else if(feedFilter==='low'||feedFilter==='high')q+='&rating_group='+feedFilter;
      q+='&sort=rating_'+(feedRatingSort==='asc'?'asc':'desc');
      return Promise.all([api(q),api('/stats?period=day')]).then(function (x) {
        var list=x[0], s=x[1];
        window.__alertMax=s.alert_max_rating;
        var repeatCount=isOwner() ? (s.open.repeated || 0) : 0;
        var banner=(s.open.alerts || repeatCount) ? '<div class="banner"><div>'+(repeatCount ? '<b>⚠ '+repeatCount+(repeatCount===1?' повторна оценка':' повторни оценки')+' за проверка</b><div class="meta">Първата оценка от всеки браузър не се брои като повторна.</div>' : '')+(s.open.alerts ? '<b>'+s.open.alerts+(s.open.alerts===1?' сигнал':' сигнала')+' за ниска оценка</b><div class="meta">Оценки '+s.alert_max_rating+'★ и по-ниски</div>' : '')+'</div><button class="btn small primary" id="seeOpen">Виж</button></div>' : '';
        var buttons=function(opts,active,data){return '<div class="fp-pills" role="group">'+opts.map(function(f){return '<button type="button" class="fp-pill'+(active===f[0]?' on':'')+'" data-'+data+'="'+f[0]+'">'+f[1]+'</button>';}).join('')+'</div>';};
        view.innerHTML='<div class="row between"><h1>Сигнали</h1><button class="btn small" id="rf">Обнови</button></div>'+banner+
          '<section class="feed-filters"><div class="feed-filter-label">Покажи</div>'+
          buttons([['all','Всички'],['new','Нови отзиви'],['low','Ниски 1–3★'],['high','Високи 4–5★']],feedFilter,'feed')+
          '<div class="feed-filter-label">Период</div>'+
          buttons([['day','Днес'],['week','7 дни'],['month','30 дни']],feedPeriod,'period')+
          '<div class="feed-sort"><span>Подредба по оценка</span><button type="button" class="btn small" id="ratingSort">'+(feedRatingSort==='asc'?'↑ От 1 към 5 ★':'↓ От 5 към 1 ★')+'</button></div></section>'+
          (isOwner() ? '<div class="card" style="margin-bottom:12px"><div class="row between"><b>Регистър на браузърите</b><button type="button" class="btn small" id="browserRegistryToggle">'+(showBrowserRegistry?'Скрий':'Покажи')+'</button></div><div id="browserRegistryContent"></div></div>' : '')+
          (list.length?'<div class="list">'+list.map(reviewCard).join('')+'</div>':'<div class="feed-empty"><b>Няма отзиви за този избор</b><p>Промени периода или филтъра, за да видиш останалите оценки.</p><button type="button" class="btn small" id="resetFeed">Покажи всички за 7 дни</button></div>');
        if (isOwner()) {
          var regBtn=$('#browserRegistryToggle'), regSlot=$('#browserRegistryContent');
          regBtn.onclick=function(){showBrowserRegistry=!showBrowserRegistry;draw().catch(fail);};
          if(showBrowserRegistry){
            regSlot.innerHTML='<p class="muted">Зареждане…</p>';
            api('/browser-registry').then(function(rows){
              if(!regSlot.isConnected)return;
              regSlot.innerHTML=rows.length?'<p class="meta">Идентификаторите са съкратени. Списъкът съдържа браузъри с поне две оценки от всички маси и за целия период.</p>'+
                '<div class="list">'+rows.map(function(b){
                  return '<div class="item"><div class="grow"><b>Браузър '+esc(b.browser_id)+'</b><div class="meta">Първа: '+dt(b.first_seen_at)+' · Последна: '+dt(b.last_seen_at)+'</div>'+
                    '<div class="meta">10 ч.: '+b.reviews_10h+' · 48 ч.: '+b.reviews_48h+' · Общо: '+b.total+'</div></div>'+
                    (b.reviews_10h>=2||b.reviews_48h>=3?'<span class="tag" style="color:#ffd7a3">⚠ Чести оценки</span>':'<span class="tag">↻ История</span>')+'</div>';
                }).join('')+'</div>':'<p class="muted">Все още няма браузър с повторни оценки.</p>';
            }).catch(function(e){if(regSlot.isConnected)regSlot.textContent=e.message||'Грешка при зареждането';});
          }
        }
        view.querySelectorAll('[data-feed]').forEach(function(b){b.onclick=function(){feedFilter=b.dataset.feed;draw().catch(fail);};});
        view.querySelectorAll('[data-period]').forEach(function(b){b.onclick=function(){feedPeriod=b.dataset.period;draw().catch(fail);};});
        $('#ratingSort').onclick=function(){feedRatingSort=feedRatingSort==='asc'?'desc':'asc';draw().catch(fail);};
        $('#rf').onclick=function(){draw().then(function(){toast('Обновено');}).catch(fail);};
        if($('#resetFeed'))$('#resetFeed').onclick=function(){feedFilter='all';feedPeriod='week';draw().catch(fail);};
        if($('#seeOpen'))$('#seeOpen').onclick=function(){feedFilter='new';feedPeriod='month';draw().catch(fail);};
        updateBadge();
      });
    }
    refreshTimer=setInterval(function(){if(!document.hidden)draw().catch(function(){});},20000);
    return draw();
  });

  // ---------- review detail ----------
  route(/^\/review\/([0-9a-f-]{36})$/, function (id) {
    chrome(true);
    function draw() {
      return Promise.all([api('/reviews/' + id), api('/settings')]).then(function (x) {
        var r = x[0], s = x[1], alert = r.rating <= s.alert_max_rating;
        view.innerHTML = '<a href="#/" class="muted">← Сигнали</a>' +
          '<div class="card" style="' + (alert ? 'border-color:#5a2129;background:#1c1215' : '') + '">' +
          '<div class="row between">' + stars(r.rating) + '<span class="pill ' + r.status + '">' + STATUS[r.status] + '</span></div>' +
          (alert ? '<div class="notice" style="background:#2a0f14;border-color:#5a2129;color:#ffc2ca">⚠️ Ниска оценка: ' + r.rating + '★.</div>' : '') +
          '<h2>' + esc(place(r)) + '</h2><div class="meta">' + dt(r.created_at) + ' · език ' + (LANG[r.lang] || '') + '</div>' +
          (r.tags && r.tags.length ? '<div class="tags">' + r.tags.map(function (t) { return '<span class="tag">' + esc(TAGS[t] || t) + '</span>'; }).join('') + '</div>' : '') +
          (r.comment ? '<div class="comment">' + esc(r.comment) + '</div>' : '<div class="meta">Без коментар</div>') +
          (r.prior_count > 0 ? '<div class="notice" style="background:#211f20;border-color:#655251;color:#f4efe9">↻ История на този браузър: оценка №' + (r.prior_count + 1) + ' · предишна ' + r.previous_rating + '★ от ' + dt(r.previous_at) + ' · сега ' + r.rating + '★ (' + (r.rating > r.previous_rating ? 'подобрение' : r.rating < r.previous_rating ? 'понижение' : 'без промяна') + ')</div>' : '') +
          (r.suspected_repeat && /10 часа|48 часа/.test(r.suspicion_reason || '') ? '<div class="notice" style="background:#302013;border-color:#a36b32;color:#ffe0b6">⚠ Чести оценки от един браузър — ' + esc(r.suspicion_reason) + '. Проверете контекста; това не доказва манипулация.</div>' : '') +
          (isOwner() ? '<div class="meta">Идентификатор на браузър: '+(r.browser_short_id ? esc(r.browser_short_id) : 'не е наличен за този отзив')+'</div>' : '') +
          (r.products && r.products.length ? '<div><h3>Ново меню</h3><div class="tags" style="margin-top:6px">' + r.products.map(function (p) { return '<span class="tag">' + (p.vote > 0 ? '👍 ' : '👎 ') + esc(p.name) + '</span>'; }).join('') + '</div></div>' : '') +
          (r.phone ? '<div><h3>Телефон (със съгласие)</h3><div class="row" style="margin-top:6px"><span class="code" style="font-size:16px;color:var(--fg)">' + esc(r.phone) + '</span><a class="btn small" href="tel:' + esc(r.phone) + '">Обади се</a></div></div>' : (r.phone_consent ? '<div class="meta">Телефонът е изтрит след срока за съхранение.</div>' : '')) +
          '</div>' +
          (isOwner() && r.browser_history && r.browser_history.length > 1 ?
            '<div class="card"><h3>История на оценките от този браузър</h3>' +
            '<p class="meta">За целия наличен период · един браузър не доказва един и същ човек</p>' +
            '<div class="list">' + r.browser_history.map(function(h,i,all){
              var prior=i ? all[i-1].rating : null;
              var trend=prior===null ? 'Първа оценка' : h.rating > prior ? '↑ Подобрение с '+(h.rating-prior)+'★' : h.rating < prior ? '↓ Спад с '+(prior-h.rating)+'★' : '→ Без промяна';
              return '<div class="item" style="border-color:'+(h.rating < prior ? '#9b3947' : 'var(--line)')+'"><div class="row between"><b>'+esc(dt(h.created_at))+'</b><b>'+h.rating+'★</b></div><div class="meta">'+trend+'</div></div>';
            }).join('')+'</div></div>' : '') +
          (r.status === 'new' ? '<div class="card">' +
            '<button class="btn primary block" id="ack">Отбележи като прочетен</button><button class="btn ok block" id="res">Архивирай отзива</button></div>' :
            '<div class="card"><div>Прегледан на ' + (r.ack_at ? tm(r.ack_at) : '—') + '</div>' +
            (r.status === 'resolved' ? '<div>Архивиран на ' + tm(r.resolved_at) + '</div>' : '<button class="btn ok block" id="res">Архивирай отзива</button>') + '</div>');
        if ($('#ack')) $('#ack').onclick = function () { api('/reviews/' + id + '/ack', { method: 'POST' }).then(function () { toast('Отзивът е отбелязан като прочетен'); draw(); updateBadge(); }).catch(function (e) { fail(e); draw(); }); };
        if ($('#res')) $('#res').onclick = function () { api('/reviews/' + id + '/resolve', { method: 'POST' }).then(function () { toast('Отзивът е архивиран'); draw(); updateBadge(); }).catch(fail); };
      });
    }
    return draw();
  });

  // ---------- stats ----------
  var statP = { period: 'mtd', from: '', to: '' };
  route(/^\/stats$/, function () {
    chrome(true);
    function qs() { return statP.period === 'custom' && statP.from ? '?from=' + statP.from + '&to=' + (statP.to || statP.from) : '?period=' + statP.period; }
    function draw() {
      return api('/stats' + qs()).then(function (s) {
        var max = Math.max.apply(null, s.distribution.map(function (d) { return d.n; }).concat([1]));
        var tmax = Math.max.apply(null, s.trend.map(function (d) { return d.n; }).concat([1]));
        var tagMax = Math.max.apply(null, s.tags.map(function (d) { return d.n; }).concat([1]));
        view.innerHTML = '<div class="rai-page-heading"><span class="rai-eyebrow">КОКТЕЙЛ-БАР РАЙ</span><h1>Анализи</h1></div>' +
          '<section class="rai-period-panel"><div class="rai-period-tabs" role="group" aria-label="Избор на период">' + [['day', 'Ден'], ['week', 'Седмица'], ['mtd', 'Месец'], ['custom', 'Период']].map(function (p) {
            return '<button type="button" data-p="' + p[0] + '" class="' + (statP.period === p[0] ? 'selected' : '') + '" aria-pressed="' + (statP.period === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>' +
          (statP.period === 'custom' ? '<div class="rai-period-dates"><label>От дата<input type="date" id="sf" value="' + statP.from + '"></label><label>До дата<input type="date" id="st" value="' + statP.to + '"></label><button type="button" class="btn primary" id="sgo">Покажи</button></div>' : '') + '</section>' +
          '<div class="kpis"><button type="button" id="rai-all-ratings" class="kpi rai-action-kpi"><div class="v">' + s.total + '</div><div class="l">Оценки ›</div><span class="rai-kpi-hint">Виж всички по маси</span></button>' +
          '<button type="button" id="rai-avg-ratings" class="kpi rai-action-kpi"><div class="v">' + (s.avg != null ? String(s.avg).replace('.', ',') + '<span class="rai-gold-star">★</span>' : '—') + '</div><div class="l">Средна оценка ›</div><span class="rai-kpi-hint">Виж оценките</span></button>' +
          '<button type="button" class="kpi rai-action-kpi" id="openNewReviewsQuick" aria-label="Покажи всички нови отзиви по маси"><div class="v">' + s.open.total + '</div><div class="l">Нови отзиви <span aria-hidden="true">›</span></div><span class="rai-kpi-hint">Виж всички по маси</span></button>' +
          '<button type="button" class="kpi rai-action-kpi rai-comments-kpi" id="rai-comments-quick" aria-label="Покажи всички коментари за избрания период"><div class="v">' + (s.comments_total || 0) + '</div><div class="l">Коментари <span aria-hidden="true">›</span></div><span class="rai-kpi-hint">По маси · за периода</span></button>' +
          '</div>' +
          '<div class="card"><h3>Разпределение</h3><div class="bars">' + s.distribution.slice().reverse().map(function (d) {
            return '<button type="button" class="bar rai-rating-bar" data-quick-rating="' + d.rating + '" aria-label="Виж оценките с ' + d.rating + ' звезди"><span>' + stars(d.rating) + '</span><span class="track"><i style="width:' + (d.n / max * 100) + '%;background:' + (d.rating <= s.alert_max_rating ? 'var(--red2)' : d.rating === 3 ? 'var(--warn)' : 'var(--ok)') + '"></i></span><span class="num">' + d.n + '</span></button>'; }).join('') + '</div></div>' +
          (s.trend.length > 1 ? '<div class="card"><h3>Тенденция по дни</h3><div class="spark">' + s.trend.map(function (d) {
            return '<div title="' + d.d + ': ' + d.n + ' оценки, ' + d.avg + '★" style="height:' + Math.max(4, d.n / tmax * 100) + '%;background:' + (d.avg < 3 ? 'var(--red2)' : d.avg < 4 ? 'var(--warn)' : 'var(--ok)') + '"></div>'; }).join('') + '</div><div class="meta">Височина: брой оценки · цвят: средна оценка за деня</div></div>' : '') +
          (isOwner() ? '<section id="stats-floorplan" class="stats-floorplan" aria-label="Анализ по маси"><p class="muted">Зареждане на схемите…</p></section>' : '') +
          '<div class="card"><h3>Категории</h3>' + (s.tags.length ? '<div class="bars">' + s.tags.map(function (t) {
            return '<div class="bar"><span>' + esc(TAGS[t.tag] || t.tag) + '</span><span class="track"><i style="width:' + (t.n / tagMax * 100) + '%;background:' + (['slow', 'cold', 'wrong', 'price', 'clean', 'noise'].indexOf(t.tag) >= 0 ? 'var(--red2)' : 'var(--ok)') + '"></i></span><span class="num">' + t.n + ' · ' + t.avg + '★</span></div>'; }).join('') + '</div><div class="meta">Червено: споменато като проблем · зелено: като харесано</div>' : '<p class="muted">Няма данни.</p>') + '</div>' +
          '<div class="card"><h3>Ново меню 👍 / 👎</h3>' + (s.products.length ? '<div class="bars">' + s.products.map(function (p) { var t = p.up + p.down || 1;
            return '<div class="bar"><span>' + esc(p.name) + '</span><span class="track"><i style="width:' + (p.up / t * 100) + '%;background:var(--ok)"></i><i style="width:' + (p.down / t * 100) + '%;background:var(--red2)"></i></span><span class="num">' + p.up + ' / ' + p.down + '</span></div>'; }).join('') + '</div>' : '<p class="muted">Няма оценки за нови продукти.</p>') + '</div>' +
          '<div class="card"><h3>По маси</h3>' + (s.tables.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Маса</th><th class="n">Оценки</th><th class="n">Средна</th><th class="n">Сигнали</th></tr></thead><tbody>' + s.tables.map(function (t) {
            return '<tr><td>' + esc([t.zone, t.label].filter(Boolean).join(' · ') || '—') + '</td><td class="n">' + t.n + '</td><td class="n">' + t.avg + '<span class="rai-gold-star">★</span></td><td class="n">' + t.alerts + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">Няма данни.</p>') + '</div>' +
          '<div class="card"><h3>Коментари</h3>' + (s.comments.length ? '<div class="list">' + s.comments.map(function (c) {
            return '<a class="rv ' + (c.rating <= s.alert_max_rating ? 'alert' : 'r' + c.rating) + '" href="#/review/' + c.id + '"><div class="row between">' + stars(c.rating) + '<span class="meta">' + dt(c.created_at) + '</span></div><div class="comment">' + esc(c.comment) + '</div><div class="meta">' + esc([c.zone_name, c.table_label ? 'Маса ' + c.table_label : ''].filter(Boolean).join(' · ')) + '</div></a>'; }).join('') + '</div>' : '<p class="muted">Няма коментари.</p>') + '</div>';
        view.querySelectorAll('[data-quick-rating]').forEach(function(b){b.onclick=function(){openNewReviewsQuick({period:statP.period,from:statP.from,to:statP.to,rating:Number(b.dataset.quickRating)});};});
        var commentsButton=$('#rai-comments-quick');if(commentsButton)commentsButton.onclick=function(){openNewReviewsQuick({kind:'comments',period:statP.period,from:statP.from,to:statP.to});};
        var quickButton = $('#openNewReviewsQuick'); if (quickButton) quickButton.onclick = function(){openNewReviewsQuick({kind:'new'});};
        var allButton=$('#rai-all-ratings');if(allButton)allButton.onclick=function(){openNewReviewsQuick({period:statP.period,from:statP.from,to:statP.to});};
        var avgButton=$('#rai-avg-ratings');if(avgButton)avgButton.onclick=function(){openNewReviewsQuick({period:statP.period,from:statP.from,to:statP.to});};
        view.querySelectorAll('.rai-period-tabs button').forEach(function (b) { b.onclick = function () {
          statP.period = b.dataset.p;
          if (statP.period === 'custom' && !statP.from) {
            var today = new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Sofia'});
            statP.from = today.slice(0,8)+'01'; statP.to = today;
          }
          draw().catch(fail);
        }; });
        if ($('#sgo')) $('#sgo').onclick = function () { statP.from = $('#sf').value; statP.to = $('#st').value; draw().catch(fail); };
        if(isOwner() && window.RAIFloorplan){var floorSlot=$('#stats-floorplan');if(floorSlot)window.RAIFloorplan.mount({view:floorSlot,api:api,toast:toast,fail:fail,tags:TAGS,embedded:true,period:statP.period,from:statP.from,to:statP.to}).catch(fail);}
      });
    }
    // Cross midnight/month boundary automatically even when Analytics stays open.
    var lastSofiaDate = new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Sofia'});
    refreshTimer=setInterval(function(){
      if(document.hidden)return;
      var today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Sofia'});
      if(today!==lastSofiaDate){lastSofiaDate=today;draw().catch(fail);}
    },60000);
    return draw();
  });

  // ---------- manage hub (owner) ----------
  route(/^\/manage$/, function () {
    chrome(true);
    if (!isOwner()) { location.hash = '#/'; return; }
    view.innerHTML = '<h1>Управление</h1><div class="list">' +
      [['#/floorplan', 'Маси за печат', 'Двете скици · QR PDF за избрани маси, цяла зала или всички маси'], ['#/tables', 'Маси и зони', 'Добавяне и настройка на масите'], ['#/menu', 'Ново меню', 'Продукти и категории за оценка'],
       ['#/users', 'Потребители', 'Управители, известия, дежурен'], ['#/settings', 'Настройки', 'Известия, адрес, Google, GDPR, защита']].map(function (x) {
        return '<a class="item" href="' + x[0] + '" style="text-decoration:none;color:var(--fg)"><span class="grow"><b>' + x[1] + '</b><br><span class="meta">' + x[2] + '</span></span><span>›</span></a>'; }).join('') + '</div>';
  });

  // ---------- interactive room maps ----------
  route(/^\/floorplan$/, function () {
    chrome(true);
    if (!isOwner()) { location.hash = '#/'; return; }
    return window.RAIFloorplan.mount({ view: view, api: api, toast: toast, fail: fail, tags: TAGS });
  });

  // ---------- tables ----------
  route(/^\/tables$/, function () {
    chrome(true);
    function draw() {
      return Promise.all([api('/zones'), api('/tables'), api('/settings')]).then(function (x) {
        var zones = x[0], tables = x[1], s = x[2];
        var zopt = function (sel) { return '<option value="">— без зона —</option>' + zones.map(function (z) { return '<option value="' + z.id + '"' + (sel === z.id ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join(''); };
        view.innerHTML = '<a href="#/manage" class="muted">← Управление</a><h1>Маси и зони</h1>' +
          (!s.public_base_url_confirmed ? '<div class="notice">Публичният адрес <b>' + esc(s.public_base_url) + '</b> още не е потвърден. Стикерите ще са с надпис „ТЕСТ“. Потвърдете адреса в Настройки, преди да печатате окончателно.</div>' : '') +
          '<div class="card"><h2>Зони</h2><div class="list">' + zones.map(function (z) {
            return '<div class="item"><span class="grow">' + esc(z.name) + (z.active ? '' : ' <span class="meta">(неактивна)</span>') + '</span><button class="btn small" data-zr="' + z.id + '">Преименувай</button><button class="btn small danger" data-zd="' + z.id + '">Изтрий</button></div>'; }).join('') +
          '</div><form class="row" id="zf"><input id="zn" placeholder="Нова зона, напр. Тераса" class="grow"><button class="btn">Добави</button></form></div>' +
          '<div class="card"><h2>Добави маси</h2><form class="row" id="tf"><label class="f">Зона<select id="tz">' + zopt() + '</select></label>' +
          '<label class="f">От №<input id="ts" type="number" min="1" value="' + (tables.length + 1) + '" style="width:90px"></label>' +
          '<label class="f">Брой<input id="tc" type="number" min="1" max="100" value="1" style="width:90px"></label>' +
          '<button class="btn primary" style="align-self:flex-end">Добави</button></form><div class="meta">Всяка маса получава собствен случаен код. Номерът се вижда само тук, не на стикера и не във формата.</div></div>' +
          '<div class="card"><div class="row between"><h2>Маси (' + tables.length + ')</h2><a class="btn small primary" href="#/print">Печат на стикери</a></div><div class="list">' + tables.map(function (t) {
            return '<div class="item"><span class="grow"><b>' + esc(t.label) + '</b> <span class="meta">' + esc(t.zone_name || 'без зона') + ' · ' + t.reviews + ' отзива' + (t.active ? '' : ' · неактивна') + '</span><br><span class="code">/r/' + esc(t.code) + '</span></span>' +
              '<select data-tz="' + t.id + '" aria-label="Зона">' + zopt(t.zone_id) + '</select>' +
              '<button class="btn small" data-tl="' + t.id + '">Номер</button><button class="btn small" data-ta="' + t.id + '" data-v="' + (!t.active) + '">' + (t.active ? 'Спри' : 'Пусни') + '</button>' +
              '<button class="btn small danger" data-td="' + t.id + '">Изтрий</button></div>'; }).join('') + '</div></div>';
        $('#zf').onsubmit = function (e) { e.preventDefault(); api('/zones', { method: 'POST', body: { name: $('#zn').value } }).then(draw).catch(fail); };
        $('#tf').onsubmit = function (e) { e.preventDefault(); api('/tables', { method: 'POST', body: { zone_id: $('#tz').value || null, start: Number($('#ts').value), count: Number($('#tc').value) } }).then(function () { toast('Масите са добавени'); draw(); }).catch(fail); };
        view.querySelectorAll('[data-zr]').forEach(function (b) { b.onclick = function () { var n = promptInline(b, 'Ново име'); if (n) n.then(function (v) { return api('/zones/' + b.dataset.zr, { method: 'PATCH', body: { name: v } }); }).then(draw).catch(fail); }; });
        view.querySelectorAll('[data-zd]').forEach(function (b) { b.onclick = confirmBtn(b, function () { return api('/zones/' + b.dataset.zd, { method: 'DELETE' }).then(draw); }); });
        view.querySelectorAll('[data-tz]').forEach(function (s2) { s2.onchange = function () { api('/tables/' + s2.dataset.tz, { method: 'PATCH', body: { zone_id: s2.value || null } }).then(function () { toast('Записано'); }).catch(fail); }; });
        view.querySelectorAll('[data-tl]').forEach(function (b) { b.onclick = function () { var n = promptInline(b, 'Номер/име'); if (n) n.then(function (v) { return api('/tables/' + b.dataset.tl, { method: 'PATCH', body: { label: v } }); }).then(draw).catch(fail); }; });
        view.querySelectorAll('[data-ta]').forEach(function (b) { b.onclick = function () { api('/tables/' + b.dataset.ta, { method: 'PATCH', body: { active: b.dataset.v === 'true' } }).then(draw).catch(fail); }; });
        view.querySelectorAll('[data-tn]').forEach(function (b) { b.onclick = confirmBtn(b, function () { return api('/tables/' + b.dataset.tn, { method: 'PATCH', body: { regenerate: true } }).then(function () { toast('Нов код – отпечатайте нов стикер'); draw(); }); }, 'Старият QR спира. Сигурно?'); });
        view.querySelectorAll('[data-td]').forEach(function (b) { b.onclick = confirmBtn(b, function () { return api('/tables/' + b.dataset.td, { method: 'DELETE' }).then(draw); }); });
      });
    }
    return draw();
  });
  // inline confirm: first tap changes the label, second tap within 4 s runs the action
  function confirmBtn(b, fn, text) {
    return function () {
      if (b.dataset.armed) { delete b.dataset.armed; Promise.resolve(fn()).catch(fail); return; }
      var old = b.textContent; b.dataset.armed = 1; b.textContent = text || 'Потвърди?';
      setTimeout(function () { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = old; } }, 4000);
    };
  }
  // inline text input replacing the button (no browser prompt dialogs)
  function promptInline(b, ph) {
    return new Promise(function (resolve) {
      var f = document.createElement('form'); f.className = 'row';
      f.innerHTML = '<input placeholder="' + esc(ph) + '" style="width:140px"><button class="btn small primary">OK</button>';
      b.replaceWith(f); var i = f.querySelector('input'); i.focus();
      f.onsubmit = function (e) { e.preventDefault(); if (i.value.trim()) resolve(i.value.trim()); };
    });
  }

  // ---------- print stickers ----------
  route(/^\/print(?:\/(\d+))?$/, function (tableId) {
    chrome(true);
    return Promise.all([api('/tables'), api('/settings')]).then(function (x) {
      var tables = x[0].filter(function (t) { return t.active && (!tableId || String(t.id) === String(tableId)); }), s = x[1];
      return Promise.all(tables.map(function (t) { return fetch('/api/admin/tables/' + t.id + '/qr.svg', { credentials: 'same-origin' }).then(function (r) { return r.text(); }); })).then(function (svgs) {
        view.innerHTML = '<div class="noprint"><a href="#/tables" class="muted">← Маси</a><h1>Печат на стикери</h1>' +
          (s.public_base_url_confirmed ? '<p class="muted">Адрес: ' + esc(s.public_base_url) + '. Печат в реален размер (100%), стикер 70 × 90 мм. Номерът е под пунктира, извън стикера.</p>' :
            '<div class="notice">Адресът не е потвърден – стикерите са маркирани „ТЕСТ“ и не са за окончателен печат.</div>') +
          '<button class="btn primary" id="downloadPdf">Изтегли PDF за агенцията</button> <button class="btn" id="pr">Печат от браузъра</button></div>' +
          '<div class="sheet">' + tables.map(function (t, i) {
            return '<div class="stk-wrap"><div class="stk"><img class="lg" src="/app/logo.png" alt=""><div class="h">Вашето мнение<br>е важно за нас</div><div class="s">Сканирайте · 10 секунди</div>' +
              '<div class="qr">' + svgs[i] + '</div><div class="lng">BG · EN · GR</div>' + (s.public_base_url_confirmed ? '' : '<div class="test">ТЕСТ</div>') + '</div>' +
              '<div class="stk-label">' + esc((t.zone_name ? t.zone_name + ' · ' : '') + 'Маса ' + t.label) + '</div></div>'; }).join('') + '</div>';
        $('#pr').onclick = function () { window.print(); };
        var pdfButton = $('#downloadPdf');
        if (pdfButton) pdfButton.onclick = function () { window.RAIPdf.export(tables.map(function (t) { return t.id; }), { filename: tableId ? 'RAI_QR_masa_' + tables[0].label + '.pdf' : 'RAI_QR_vsichki_masi.pdf' }).then(function () { toast('PDF файлът е изтеглен'); }).catch(fail); };
      });
    });
  });

  // ---------- menu ----------
  route(/^\/menu$/, function () {
    chrome(true);
    function draw() {
      return Promise.all([api('/categories'), api('/products')]).then(function (x) {
        var cats = x[0], prods = x[1];
        var copt = function (sel) { return '<option value="">— без категория —</option>' + cats.map(function (c) { return '<option value="' + c.id + '"' + (sel === c.id ? ' selected' : '') + '>' + esc(c.name_bg) + '</option>'; }).join(''); };
        view.innerHTML = '<a href="#/manage" class="muted">← Управление</a><h1>Ново меню</h1><p class="muted">Във формата се показват активните продукти, отбелязани като „ново“. Имената на EN и GR не са задължителни – ако липсват, се показва българското.</p>' +
          '<div class="card"><h2>Категории</h2><div class="list">' + cats.map(function (c) {
            return '<div class="item"><span class="grow">' + esc(c.name_bg) + (c.name_en ? ' <span class="meta">/ ' + esc(c.name_en) + '</span>' : '') + (c.active ? '' : ' <span class="meta">(скрита)</span>') + '</span><button class="btn small" data-ca="' + c.id + '" data-v="' + (!c.active) + '">' + (c.active ? 'Скрий' : 'Покажи') + '</button><button class="btn small danger" data-cd="' + c.id + '">Изтрий</button></div>'; }).join('') +
          '</div><form class="row" id="cf"><input id="cbg" placeholder="Име (BG)" class="grow" required><input id="cen" placeholder="EN" style="width:110px"><input id="cel" placeholder="GR" style="width:110px"><button class="btn">Добави</button></form></div>' +
          '<div class="card"><h2>Продукти</h2><form class="row" id="pf"><input id="pbg" placeholder="Име (BG)" class="grow" required><input id="pen" placeholder="EN" style="width:120px"><input id="pel" placeholder="GR" style="width:120px"><select id="pc">' + copt() + '</select><button class="btn primary">Добави</button></form>' +
          '<div class="list">' + prods.map(function (p) {
            return '<div class="item"><span class="grow"><b>' + esc(p.name_bg) + '</b> <span class="meta">' + esc(p.cat_name || 'без категория') + ' · 👍 ' + (p.up || 0) + ' / 👎 ' + (p.down || 0) + '</span>' + (p.active ? '' : ' <span class="meta">· скрит</span>') + '</span>' +
              '<select data-pc="' + p.id + '">' + copt(p.category_id) + '</select>' +
              '<button class="btn small" data-pn="' + p.id + '" data-v="' + (!p.is_new) + '">' + (p.is_new ? 'Ново ✓' : 'Не е ново') + '</button>' +
              '<button class="btn small" data-pa="' + p.id + '" data-v="' + (!p.active) + '">' + (p.active ? 'Скрий' : 'Покажи') + '</button><button class="btn small danger" data-pd="' + p.id + '">Изтрий</button></div>'; }).join('') + '</div></div>';
        $('#cf').onsubmit = function (e) { e.preventDefault(); api('/categories', { method: 'POST', body: { name_bg: $('#cbg').value, name_en: $('#cen').value, name_el: $('#cel').value } }).then(draw).catch(fail); };
        $('#pf').onsubmit = function (e) { e.preventDefault(); api('/products', { method: 'POST', body: { name_bg: $('#pbg').value, name_en: $('#pen').value, name_el: $('#pel').value, category_id: $('#pc').value || null } }).then(function () { toast('Продуктът е добавен'); draw(); }).catch(fail); };
        view.querySelectorAll('[data-ca]').forEach(function (b) { b.onclick = function () { api('/categories/' + b.dataset.ca, { method: 'PATCH', body: { active: b.dataset.v === 'true' } }).then(draw).catch(fail); }; });
        view.querySelectorAll('[data-cd]').forEach(function (b) { b.onclick = confirmBtn(b, function () { return api('/categories/' + b.dataset.cd, { method: 'DELETE' }).then(draw); }); });
        view.querySelectorAll('[data-pc]').forEach(function (s2) { s2.onchange = function () { api('/products/' + s2.dataset.pc, { method: 'PATCH', body: { category_id: s2.value || null } }).then(function () { toast('Записано'); }).catch(fail); }; });
        view.querySelectorAll('[data-pn]').forEach(function (b) { b.onclick = function () { api('/products/' + b.dataset.pn, { method: 'PATCH', body: { is_new: b.dataset.v === 'true' } }).then(draw).catch(fail); }; });
        view.querySelectorAll('[data-pa]').forEach(function (b) { b.onclick = function () { api('/products/' + b.dataset.pa, { method: 'PATCH', body: { active: b.dataset.v === 'true' } }).then(draw).catch(fail); }; });
        view.querySelectorAll('[data-pd]').forEach(function (b) { b.onclick = confirmBtn(b, function () { return api('/products/' + b.dataset.pd, { method: 'DELETE' }).then(draw); }); });
      });
    }
    return draw();
  });

  // ---------- users ----------
  route(/^\/users$/, function () {
    chrome(true);
    function draw() {
      return api('/users').then(function (users) {
        view.innerHTML = '<a href="#/manage" class="muted">← Управление</a><h1>Потребители</h1>' +
          '<div class="list">' + users.map(function (u) {
            var self = u.id === me.id;
            return '<div class="item"><span class="grow"><b>' + esc(u.name) + '</b> ' + (u.on_duty ? '<span class="pill acknowledged">Дежурен</span>' : '') + '<br><span class="meta">' + (u.role === 'owner' ? 'Собственик' : 'Управител') + ' · ' + esc(u.email || '') + ' · устройства: ' + u.devices + (u.active ? '' : ' · деактивиран') + '</span></span>' +
              '<button class="btn small" data-ud="' + u.id + '" data-v="' + (!u.on_duty) + '">' + (u.on_duty ? 'Махни дежурство' : 'Дежурен') + '</button>' +
              '<button class="btn small" data-un="' + u.id + '" data-v="' + (!u.notify) + '">Известия: ' + (u.notify ? 'вкл.' : 'изкл.') + '</button>' +
              (self ? '' : '<button class="btn small" data-up="' + u.id + '">Нова парола</button><button class="btn small ' + (u.active ? 'danger' : '') + '" data-ua="' + u.id + '" data-v="' + (!u.active) + '">' + (u.active ? 'Деактивирай' : 'Активирай') + '</button>') + '</div>'; }).join('') + '</div>' +
          '<div class="card"><h2>Нов управител</h2><form id="uf" class="list"><label class="f">Име<input id="un" required></label><label class="f">Имейл<input id="ue" type="email" required autocomplete="off"></label>' +
          '<label class="f">Начална парола (мин. 10 символа)<input id="up" type="text" minlength="10" required autocomplete="off"></label><label class="f">Роля<select id="ur"><option value="manager">Управител</option><option value="owner">Собственик</option></select></label>' +
          '<button class="btn primary">Добави</button></form><p class="meta">Дайте на управителя имейла и паролата. След вход той сам включва известията от „Профил“.</p></div>';
        view.querySelectorAll('[data-ud]').forEach(function (b) { b.onclick = function () { api('/users/' + b.dataset.ud, { method: 'PATCH', body: { on_duty: b.dataset.v === 'true' } }).then(draw).catch(fail); }; });
        view.querySelectorAll('[data-un]').forEach(function (b) { b.onclick = function () { api('/users/' + b.dataset.un, { method: 'PATCH', body: { notify: b.dataset.v === 'true' } }).then(draw).catch(fail); }; });
        view.querySelectorAll('[data-ua]').forEach(function (b) { b.onclick = confirmBtn(b, function () { return api('/users/' + b.dataset.ua, { method: 'PATCH', body: { active: b.dataset.v === 'true' } }).then(draw); }); });
        view.querySelectorAll('[data-up]').forEach(function (b) { b.onclick = function () { var n = promptInline(b, 'Нова парола'); n.then(function (v) { return api('/users/' + b.dataset.up, { method: 'PATCH', body: { password: v } }); }).then(function () { toast('Паролата е сменена'); draw(); }).catch(fail); }; });
        $('#uf').onsubmit = function (e) { e.preventDefault(); api('/users', { method: 'POST', body: { name: $('#un').value, email: $('#ue').value, password: $('#up').value, role: $('#ur').value } }).then(function () { toast('Потребителят е добавен'); draw(); }).catch(fail); };
      });
    }
    return draw();
  });

  // ---------- settings ----------
  route(/^\/settings$/, function () {
    chrome(true);
    function draw() {
      return Promise.all([api('/settings'), api('/errors').catch(function () { return []; })]).then(function (x) {
        var s = x[0], errs = x[1];
        view.innerHTML = '<a href="#/manage" class="muted">← Управление</a><h1>Настройки</h1><form id="sf" class="list">' +
          '<div class="card"><h2>Известия</h2><div class="meta">За кои оценки се праща push. Всички оценки винаги се записват и влизат в статистиката.</div><div class="row">' +
          [1, 2, 3, 4, 5].map(function (n) { return '<label class="chk"><input type="checkbox" name="nr" value="' + n + '"' + (s.notify_ratings.indexOf(n) >= 0 ? ' checked' : '') + '> ' + n + '★</label>'; }).join('') + '</div>' +
          '<label class="f">Сигнал (червено, проследяване) при оценка до<select id="am">' + [0, 1, 2, 3].map(function (n) { return '<option value="' + n + '"' + (s.alert_max_rating === n ? ' selected' : '') + '>' + (n ? n + '★' : 'без сигнали') + '</option>'; }).join('') + '</select></label>' +
          '<label class="chk"><input type="checkbox" id="esc"' + (s.escalate_unacked ? ' checked' : '') + '> Повторно известие до всички, ако сигналът не е поет навреме</label></div>' +
          '<div class="card"><h2>Публичен адрес и Google</h2><label class="f">Адрес за QR кодовете<input id="pu" type="url" value="' + esc(s.public_base_url) + '"></label>' +
          '<label class="chk"><input type="checkbox" id="puc"' + (s.public_base_url_confirmed ? ' checked' : '') + '> Адресът е потвърден и работи – стикерите са окончателни</label>' +
          '<label class="f">Директен линк за Google отзив<input id="gu" type="url" placeholder="https://g.page/r/…/review" value="' + esc(s.google_review_url) + '"></label><div class="meta">Бутонът се показва на всички гости след изпращане, независимо от оценката.</div></div>' +
          '<div class="card"><h2>GDPR и защита</h2><label class="f">Телефоните се изтриват след (дни)<input id="pr" type="number" min="1" max="730" value="' + s.phone_retention_days + '"></label>' +
          '<label class="f">Макс. отзиви от едно устройство за 10 мин<input id="rd" type="number" min="1" max="100" value="' + s.rate_limit_per_device_10min + '"></label>' +
          '<label class="f">Макс. отзиви от една маса за 30 мин<input id="rt" type="number" min="1" max="500" value="' + s.rate_limit_per_table_30min + '"></label>' +
          '<label class="f">Минимално време за попълване (сек.)<input id="mf" type="number" min="0" max="60" value="' + s.min_fill_seconds + '"></label></div>' +
          '<div class="card"><h2>Адрес на заведението във формата</h2><label class="f">BG<input id="vbg" value="' + esc(s.venue_address_bg) + '"></label><label class="f">EN<input id="ven" value="' + esc(s.venue_address_en) + '"></label><label class="f">GR<input id="vel" value="' + esc(s.venue_address_el) + '"></label></div>' +
          '<button class="btn primary block">Запази настройките</button></form>' +
          '<div class="card"><h2>Грешки в системата</h2>' + (errs.length ? '<div class="list">' + errs.slice(0, 20).map(function (e) { return '<div class="item"><span class="grow"><span class="meta">' + dt(e.at) + ' · ' + esc(e.source) + '</span><br>' + esc(e.message) + '</span></div>'; }).join('') + '</div>' : '<p class="muted">Няма записани грешки.</p>') + '</div>';
        $('#sf').onsubmit = function (e) {
          e.preventDefault();
          var nr = []; view.querySelectorAll('input[name=nr]:checked').forEach(function (c) { nr.push(Number(c.value)); });
          api('/settings', { method: 'PUT', body: {
            notify_ratings: nr, alert_max_rating: Number($('#am').value), ack_target_minutes: s.ack_target_minutes, escalate_unacked: $('#esc').checked,
            public_base_url: $('#pu').value, public_base_url_confirmed: $('#puc').checked, google_review_url: $('#gu').value,
            phone_retention_days: Number($('#pr').value), rate_limit_per_device_10min: Number($('#rd').value), rate_limit_per_table_30min: Number($('#rt').value),
            min_fill_seconds: Number($('#mf').value), venue_address_bg: $('#vbg').value, venue_address_en: $('#ven').value, venue_address_el: $('#vel').value
          } }).then(function () { toast('Настройките са записани'); draw(); }).catch(fail);
        };
      });
    }
    return draw();
  });

  // ---------- me: notifications, install, password ----------
  function platform() {
    var ua = navigator.userAgent;
    var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    return { ios: ios, android: /Android/.test(ua), standalone: standalone, pushOk: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window };
  }
  function b64ToU8(s) { var p = '='.repeat((4 - s.length % 4) % 4); var b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function currentSub() { return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }); }
  function enablePush() {
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Известията са отказани. Разрешете ги от настройките на телефона.');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(me.vapid_public_key) }); });
    }).then(function (sub) { return api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } }); });
  }
  route(/^\/me$/, function () {
    chrome(true);
    var p = platform();
    return Promise.all([api('/push/devices'), p.pushOk ? currentSub().catch(function () { return null; }) : Promise.resolve(null)]).then(function (x) {
      var devices = x[0], sub = x[1];
      var perm = 'Notification' in window ? Notification.permission : 'unsupported';
      var install = p.standalone ? '<p class="meta">✓ Приложението е инсталирано на това устройство.</p>' :
        p.ios ? '<ol class="steps"><li>Отворете този адрес в <b>Safari</b>.</li><li>Натиснете бутона <b>Сподели</b> (квадрат със стрелка).</li><li>Изберете <b>„Добави към началния екран“</b> → Добави.</li><li>Отворете „РАЙ Оценка“ от иконата и влезте отново.</li><li>Тук натиснете „Включи известията“.</li></ol><p class="meta">На iPhone известията работят само от инсталираното приложение и iOS 16.4 или по-нов.</p>' :
        '<ol class="steps"><li>Отворете адреса в <b>Chrome</b>.</li><li>Меню <b>⋮</b> → <b>„Инсталиране на приложението“</b> (или „Добавяне към началния екран“).</li><li>Отворете „РАЙ Оценка“ от иконата.</li><li>Натиснете „Включи известията“.</li></ol>';
      var pushBlock = !p.pushOk ? '<div class="notice">' + (p.ios && !p.standalone ? 'Първо инсталирайте приложението (стъпките по-долу), после включете известията.' : 'Този браузър не поддържа push известия.') + '</div>' :
        sub ? '<p>✓ Известията са включени на това устройство.</p><div class="row"><button class="btn" id="tp">Изпрати тестово известие</button><button class="btn danger" id="dp">Изключи на това устройство</button></div>' :
        '<button class="btn primary block" id="ep">Включи известията</button>' + (perm === 'denied' ? '<div class="notice">Известията са блокирани за това приложение. Разрешете ги от настройките на телефона и опитайте отново.</div>' : '');
      view.innerHTML = '<h1>Профил</h1><div class="card"><div><b>' + esc(me.name) + '</b> · ' + (me.role === 'owner' ? 'Собственик' : 'Управител') + '<br><span class="meta">' + esc(me.email) + '</span></div>' +
        '<label class="chk"><input type="checkbox" id="mn"' + (me.notify ? ' checked' : '') + '> Получавам известия за оценки</label>' +
        '<label class="chk"><input type="checkbox" id="md"' + (me.on_duty ? ' checked' : '') + '> Аз съм дежурен управител сега</label></div>' +
        '<div class="card"><h2>Известия на това устройство</h2>' + pushBlock + '<div class="meta">Устройства с включени известия: ' + devices.length + '</div></div>' +
        '<div class="card"><h2>Инсталиране на телефона</h2>' + install + '</div>' +
        '<div class="card"><h2>Смяна на парола</h2><form id="pw" class="list"><input id="pc" type="password" placeholder="Текуща парола" autocomplete="current-password" required><input id="pn" type="password" placeholder="Нова парола (мин. 10 символа)" autocomplete="new-password" minlength="10" required><button class="btn">Смени</button></form></div>' +
        '<button class="btn block" id="lo">Изход</button>';
      $('#mn').onchange = function () { api('/me', { method: 'PATCH', body: { notify: this.checked } }).then(loadMe).then(function () { toast('Записано'); }).catch(fail); };
      $('#md').onchange = function () { api('/me', { method: 'PATCH', body: { on_duty: this.checked } }).then(loadMe).then(function () { toast('Записано'); }).catch(fail); };
      if ($('#ep')) $('#ep').onclick = function () { this.disabled = true; enablePush().then(function () { toast('Известията са включени'); go(); }).catch(function (e) { fail(e); go(); }); };
      if ($('#tp')) $('#tp').onclick = function () { api('/push/test', { method: 'POST' }).then(function (r) { toast(r.delivered ? 'Изпратено. Трябва да пристигне до секунди.' : 'Няма устройство за известия.'); }).catch(fail); };
      if ($('#dp')) $('#dp').onclick = function () { currentSub().then(function (s) { if (!s) return; return api('/push/unsubscribe', { method: 'POST', body: { endpoint: s.endpoint } }).then(function () { return s.unsubscribe(); }); }).then(function () { toast('Изключено'); go(); }).catch(fail); };
      $('#pw').onsubmit = function (e) { e.preventDefault(); api('/auth/password', { method: 'POST', body: { current: $('#pc').value, next: $('#pn').value } }).then(function () { toast('Паролата е сменена'); $('#pw').reset(); }).catch(fail); };
      $('#lo').onclick = function () { api('/auth/logout', { method: 'POST' }).then(function () { me = null; location.hash = '#/login'; }); };
    });
  });

  // ---------- boot ----------
  function loadMe() { return api('/auth/me').then(function (u) { me = u; return u; }); }
  if ('serviceWorker' in navigator) {
    // The installed phone app must receive the newest code, not keep an old shell.
    var hadController = !!navigator.serviceWorker.controller;
    var refreshedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController && !refreshedForUpdate) {
        refreshedForUpdate = true;
        window.location.reload();
      }
      hadController = true;
    });
    var swRegistration = null;
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/', updateViaCache: 'none' })
      .then(function (reg) { swRegistration = reg; return reg.update(); })
      .catch(function () {});
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && swRegistration) swRegistration.update().catch(function () {});
    });
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (!e.data) return;
      if (e.data.type === 'open' && e.data.url) { var u = new URL(e.data.url); if (u.hash) location.hash = u.hash; }
      if (e.data.type === 'review') { updateBadge(); if ((location.hash || '#/') === '#/') go(); }
    });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && me) updateBadge(); });
  fetch('/api/admin/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (u) { me = u; if (!u) location.hash = '#/login'; else if (!location.hash || location.hash === '#') location.hash = '#/stats'; go(); })
    .catch(function () { location.hash = '#/login'; go(); });
})();
