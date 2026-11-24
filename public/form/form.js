(function () {
  'use strict';
  var T = {
    bg: { loading: 'Зареждане…', notfound: 'Този QR код не е активен. Моля, обърнете се към персонала.',
      title: 'Вашето мнение е важно за нас', lead: 'Отнема 10 секунди. Отговорите са анонимни.', q1: 'Оценете посещението си',
      low: 'Какво не Ви хареса?', high: 'Какво Ви хареса най-много?', multi: 'Можете да изберете повече от едно.', detailTitle: 'Бихте ли уточнили?', detailHint: 'По желание — можете да посочите повече от едно.', q3: 'Опитахте ли нещо от новото меню?', q4: 'Искате ли да добавите нещо?', opt: 'по желание',
      ph4: 'Какво Ви хареса или какво да подобрим?', q5: 'Желаете ли да се свържем с Вас?',
      gdpr: 'Съгласявам се Рай да използва телефона ми само за връзка по този отзив.', privacy: 'Как пазим данните',
      send: 'Изпратете', hint: 'Изберете оценка, за да продължите.', hint2: 'Готово, можете да изпратите.', sending: 'Изпращане…',
      ty: 'Благодарим Ви, че избрахте РАЙ! ❤️', ty2: 'Ще се радваме да Ви посрещнем отново!',
      errNet: 'Няма връзка. Опитайте отново – отзивът няма да се дублира.', errRate: 'Получихме много отзиви от това устройство. Опитайте по-късно.',
      errFast: 'Моля, отделете няколко секунди и опитайте отново.', errGen: 'Нещо се обърка. Опитайте отново.', phoneBad: 'Въведете валиден телефон или махнете отметката.', phoneConsentNeeded: 'За да се свържем с Вас, отбележете съгласието под телефона.',
      stars: ['', 'Много зле', 'Зле', 'Средно', 'Добре', 'Отлично'], starAria: 'звезди',
      lowc: { slow: 'Забавено обслужване', cold: 'Храната беше студена', wrong: 'Объркана поръчка', price: 'Високи цени', clean: 'Недостатъчна чистота', noise: 'Прекалено шумно', quality: 'Качество на храната', attitude: 'Невнимателно отношение' },
      highc: { food: 'Вкусна храна', drinks: 'Хубави напитки', staff: 'Любезно обслужване', atmosphere: 'Приятна атмосфера', music: 'Музиката', value: 'Добро съотношение цена–качество' } },
    en: { loading: 'Loading…', notfound: 'This QR code is not active. Please ask our staff.',
      title: 'Your opinion matters to us', lead: 'Takes 10 seconds. Answers are anonymous.', q1: 'Rate your visit',
      low: 'What went wrong?', high: 'What did you like most?', multi: 'You can select more than one.', detailTitle: 'Could you tell us more?', detailHint: 'Optional — choose any that apply.', q3: 'Did you try something from the new menu?', q4: 'Anything to add?', opt: 'optional',
      ph4: 'What did you like, or what should we improve?', q5: 'Would you like us to contact you?',
      gdpr: 'I agree that Rai may use my phone number only to contact me about this review.', privacy: 'How we keep your data',
      send: 'Send', hint: 'Choose a rating to continue.', hint2: 'Ready to send.', sending: 'Sending…',
      ty: 'Thank you for choosing RAI! ❤️', ty2: 'We look forward to welcoming you again!',
      errNet: 'No connection. Please try again – your review will not be duplicated.', errRate: 'Too many reviews from this device. Please try later.',
      errFast: 'Please take a few seconds and try again.', errGen: 'Something went wrong. Please try again.', phoneBad: 'Enter a valid phone number or untick the box.', phoneConsentNeeded: 'To let us contact you, tick the consent box below the phone number.',
      stars: ['', 'Very bad', 'Bad', 'OK', 'Good', 'Excellent'], starAria: 'stars',
      lowc: { slow: 'Delayed service', cold: 'Food was cold', wrong: 'Incorrect order', price: 'Prices too high', clean: 'Not clean enough', noise: 'Too noisy', quality: 'Food quality', attitude: 'Inattentive service' },
      highc: { food: 'The food', drinks: 'Drinks', staff: 'The staff', atmosphere: 'Atmosphere', music: 'Music', value: 'Price' } },
    el: { loading: 'Φόρτωση…', notfound: 'Αυτός ο κωδικός QR δεν είναι ενεργός. Ρωτήστε το προσωπικό.',
      title: 'Η γνώμη σας είναι σημαντική για εμάς', lead: 'Παίρνει 10 δευτερόλεπτα. Οι απαντήσεις είναι ανώνυμες.', q1: 'Αξιολογήστε την επίσκεψή σας',
      low: 'Τι δεν πήγε καλά;', high: 'Τι σας άρεσε περισσότερο;', multi: 'Μπορείτε να επιλέξετε περισσότερα από ένα.', detailTitle: 'Θα θέλατε να διευκρινίσετε;', detailHint: 'Προαιρετικά — επιλέξτε όσα ισχύουν.', q3: 'Δοκιμάσατε κάτι από το νέο μενού;', q4: 'Κάτι να προσθέσετε;', opt: 'προαιρετικά',
      ph4: 'Τι σας άρεσε ή τι να βελτιώσουμε;', q5: 'Θέλετε να επικοινωνήσουμε μαζί σας;',
      gdpr: 'Συμφωνώ το Rai να χρησιμοποιήσει το τηλέφωνό μου μόνο για επικοινωνία σχετικά με αυτή την αξιολόγηση.', privacy: 'Πώς προστατεύουμε τα δεδομένα',
      send: 'Αποστολή', hint: 'Επιλέξτε βαθμολογία για να συνεχίσετε.', hint2: 'Έτοιμο για αποστολή.', sending: 'Αποστολή…',
      ty: 'Ευχαριστούμε που επιλέξατε το RAI! ❤️', ty2: 'Θα χαρούμε να σας καλωσορίσουμε ξανά!',
      errNet: 'Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά – η αξιολόγηση δεν θα διπλασιαστεί.', errRate: 'Πολλές αξιολογήσεις από αυτή τη συσκευή. Δοκιμάστε αργότερα.',
      errFast: 'Περιμένετε λίγα δευτερόλεπτα και δοκιμάστε ξανά.', errGen: 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.', phoneBad: 'Εισαγάγετε έγκυρο τηλέφωνο ή αποεπιλέξτε το κουτάκι.', phoneConsentNeeded: 'Για να επικοινωνήσουμε μαζί σας, επιλέξτε το πλαίσιο συγκατάθεσης κάτω από το τηλέφωνο.',
      stars: ['', 'Πολύ κακό', 'Κακό', 'Μέτριο', 'Καλό', 'Εξαιρετικό'], starAria: 'αστέρια',
      lowc: { slow: 'Καθυστέρηση εξυπηρέτησης', cold: 'Το φαγητό ήταν κρύο', wrong: 'Λάθος παραγγελία', price: 'Υψηλές τιμές', clean: 'Ελλιπής καθαριότητα', noise: 'Υπερβολικός θόρυβος', quality: 'Ποιότητα φαγητού', attitude: 'Απρόσεκτη εξυπηρέτηση' },
      highc: { food: 'Το φαγητό', drinks: 'Τα ποτά', staff: 'Το προσωπικό', atmosphere: 'Η ατμόσφαιρα', music: 'Η μουσική', value: 'Η τιμή' } }
  };
  var DETAIL_OPTIONS = {
  "bg": {
    "slow": {
      "slow_order": "Чаках да вземат поръчката",
      "slow_food": "Чаках храната",
      "slow_drinks": "Чаках напитките",
      "slow_bill": "Чаках сметката"
    },
    "cold": {
      "cold_arrived": "Храната пристигна студена"
    },
    "wrong": {
      "wrong_item": "Донесоха грешен продукт",
      "wrong_missing": "Липсваше част от поръчката"
    },
    "price": {
      "price_food": "Храната е скъпа",
      "price_drinks": "Напитките са скъпи",
      "price_value": "Цената не отговаря на качеството"
    },
    "clean": {
      "clean_table": "Масата не беше почистена",
      "clean_dishes": "Чаши или прибори",
      "clean_wc": "Тоалетните",
      "clean_area": "Около масата"
    },
    "noise": {
      "noise_music": "Музиката беше силна",
      "noise_guests": "Шум от други клиенти",
      "noise_kids": "Шум от детския кът"
    },
    "quality": {
      "quality_taste": "Вкусът не ми хареса",
      "quality_cooking": "Не беше добре приготвена",
      "quality_portion": "Порцията не отговаряше на очакванията"
    },
    "attitude": {
      "attitude_rude": "Нелюбезно отношение",
      "attitude_ignored": "Не ни обърнаха внимание",
      "attitude_help": "Не получих съдействие"
    }
  },
  "en": {
    "slow": {
      "slow_order": "Waiting for order to be taken",
      "slow_food": "Waiting for food",
      "slow_drinks": "Waiting for drinks",
      "slow_bill": "Waiting for the bill"
    },
    "cold": {
      "cold_arrived": "Food arrived cold"
    },
    "wrong": {
      "wrong_item": "Received the wrong item",
      "wrong_missing": "Part of the order was missing"
    },
    "price": {
      "price_food": "Food prices",
      "price_drinks": "Drink prices",
      "price_value": "Price did not match the quality"
    },
    "clean": {
      "clean_table": "Table was not clean",
      "clean_dishes": "Glasses or cutlery",
      "clean_wc": "Restrooms",
      "clean_area": "Around our table"
    },
    "noise": {
      "noise_music": "Music too loud",
      "noise_guests": "Noise from other guests",
      "noise_kids": "Noise from the kids’ area"
    },
    "quality": {
      "quality_taste": "Did not like the taste",
      "quality_cooking": "Not prepared well",
      "quality_portion": "Portion did not meet expectations"
    },
    "attitude": {
      "attitude_rude": "Unfriendly attitude",
      "attitude_ignored": "Staff did not pay attention",
      "attitude_help": "Could not get help"
    }
  },
  "el": {
    "slow": {
      "slow_order": "Καθυστέρηση στη λήψη παραγγελίας",
      "slow_food": "Καθυστέρηση φαγητού",
      "slow_drinks": "Καθυστέρηση ποτών",
      "slow_bill": "Καθυστέρηση λογαριασμού"
    },
    "cold": {
      "cold_arrived": "Το φαγητό έφτασε κρύο"
    },
    "wrong": {
      "wrong_item": "Λάθος προϊόν",
      "wrong_missing": "Έλειπε μέρος της παραγγελίας"
    },
    "price": {
      "price_food": "Ακριβό φαγητό",
      "price_drinks": "Ακριβά ποτά",
      "price_value": "Η τιμή δεν αντιστοιχούσε στην ποιότητα"
    },
    "clean": {
      "clean_table": "Το τραπέζι δεν ήταν καθαρό",
      "clean_dishes": "Ποτήρια ή μαχαιροπίρουνα",
      "clean_wc": "Τουαλέτες",
      "clean_area": "Γύρω από το τραπέζι"
    },
    "noise": {
      "noise_music": "Δυνατή μουσική",
      "noise_guests": "Θόρυβος από πελάτες",
      "noise_kids": "Θόρυβος από τον παιδότοπο"
    },
    "quality": {
      "quality_taste": "Δεν μου άρεσε η γεύση",
      "quality_cooking": "Δεν ήταν σωστά μαγειρεμένο",
      "quality_portion": "Η μερίδα δεν ήταν όπως περίμενα"
    },
    "attitude": {
      "attitude_rude": "Αγένεια",
      "attitude_ignored": "Δεν μας έδωσαν προσοχή",
      "attitude_help": "Δεν λάβαμε βοήθεια"
    }
  }
};
  var $ = function (s) { return document.querySelector(s); };
  var code = (location.pathname.match(/^\/r\/([A-Za-z0-9]{6,20})/) || [])[1];
  var langPref; try { langPref = localStorage.getItem('rai_lang'); } catch (e) {}
  var nav = (navigator.language || 'bg').slice(0, 2);
  var lang = T[langPref] ? langPref : (nav === 'el' ? 'el' : 'bg');
  var cfg = null, rating = 0, chips = {}, details = {}, votes = {}, sending = false;
  var submissionId = uuid();
  // First-party random browser marker; persists across table QR scans in the same browser.
  // No fingerprinting, phone number, or exact location is used.
  var browserId = null;
  try {
    browserId = localStorage.getItem('rai_review_browser_id');
    if (!browserId || !/^[0-9a-f-]{36}$/i.test(browserId)) {
      browserId = uuid();
      localStorage.setItem('rai_review_browser_id', browserId);
    }
  } catch(e) { browserId = null; }
  var starSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.7-5.1 4.6 1.5 6.7L12 17.3l-6.1 3.4 1.5-6.7L2.3 9.4l6.8-.7z"/></svg>';

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pname(p, kind) { return (lang === 'en' ? p[kind + '_en'] : lang === 'el' ? p[kind + '_el'] : null) || p[kind + '_bg']; }

  function render() {
    var t = T[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(function (e) { e.textContent = t[e.dataset.t] || ''; });
    document.querySelectorAll('[data-tp]').forEach(function (e) { e.placeholder = t[e.dataset.tp]; });
    document.querySelectorAll('.langs button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.lang === lang); });
    if (cfg) $('#addr').textContent = cfg.address[lang] || cfg.address.bg || '';
    var st = $('#stars'); st.innerHTML = ''; st.setAttribute('aria-label', t.q1);
    for (var i = 1; i <= 5; i++) (function (i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'star' + (i <= rating ? ' on' : ''); b.innerHTML = starSvg;
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', i === rating); b.setAttribute('aria-label', i + ' ' + t.starAria + ' – ' + t.stars[i]);
      b.onclick = function () { if (rating && (rating <= 3) !== (i <= 3)) { chips = {}; details = {}; } rating = i; render(); };
      st.appendChild(b);
    })(i);
    $('#starLabel').textContent = rating ? t.stars[rating] : '';
    var on = rating > 0;
    $('#step2').hidden = !on; $('#step4').hidden = !on;
    $('#step3').hidden = !on || !(cfg && cfg.products.length);
    $('#send').disabled = !on || sending;
    $('#send').textContent = sending ? t.sending : t.send;
    $('#hint').textContent = on ? t.hint2 : t.hint;
    if (on) {
      var low = rating <= 3, list = low ? t.lowc : t.highc, c = $('#chips');
      $('#q2').textContent = low ? t.low : t.high; $('#multiHint').textContent = t.multi; c.innerHTML = '';
      Object.keys(list).forEach(function (k) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = list[k];
        b.setAttribute('aria-pressed', !!chips[k]); b.onclick = function () { chips[k] = !chips[k]; if(!chips[k] && DETAIL_OPTIONS.bg[k]) Object.keys(DETAIL_OPTIONS.bg[k]).forEach(function(d){delete details[d];}); render(); }; c.appendChild(b);
      });
      var dl = $('#details'); dl.innerHTML='';
      if (low) Object.keys(t.lowc).forEach(function(k){
        if(!chips[k] || !DETAIL_OPTIONS[lang][k]) return;
        var group=document.createElement('section');group.className='detail-group';
        var heading=document.createElement('div');heading.className='detail-heading';heading.textContent=t.lowc[k];group.appendChild(heading);
        var choices=document.createElement('div');choices.className='detail-choices';
        Object.keys(DETAIL_OPTIONS[lang][k]).forEach(function(d){
          var b=document.createElement('button');b.type='button';b.className='detail-chip';b.textContent=DETAIL_OPTIONS[lang][k][d];
          b.setAttribute('aria-pressed',!!details[d]);b.onclick=function(){details[d]=!details[d];render();};choices.appendChild(b);
        });group.appendChild(choices);dl.appendChild(group);
      });
      $('#detailsWrap').hidden=!low || !dl.children.length;
      $('#detailTitle').textContent=t.detailTitle;$('#detailHint').textContent=t.detailHint;
    }
    if (cfg) {
      var d = $('#dishes'), html = '', lastCat = null, cats = {};
      cfg.products.forEach(function (p) { cats[p.cat_bg || ''] = 1; });
      var showCats = Object.keys(cats).length > 1;
      cfg.products.forEach(function (p) {
        var cat = p.cat_bg ? pname(p, 'cat') : '';
        if (showCats && cat !== lastCat) { html += '<div class="cat">' + esc(cat) + '</div>'; lastCat = cat; }
        var n = esc(pname(p, 'name'));
        html += '<div class="dish"><span>' + n + '<span class="new">NEW</span></span><span class="thumbs">' +
          '<button type="button" class="up" data-id="' + p.id + '" data-v="1" aria-pressed="' + (votes[p.id] === 1) + '" aria-label="👍 ' + n + '">👍</button>' +
          '<button type="button" class="down" data-id="' + p.id + '" data-v="-1" aria-pressed="' + (votes[p.id] === -1) + '" aria-label="👎 ' + n + '">👎</button></span></div>';
      });
      d.innerHTML = html;
    }
  }
  $('#dishes').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]'); if (!b) return;
    var id = b.dataset.id, v = Number(b.dataset.v); votes[id] = votes[id] === v ? 0 : v; render();
  });
  document.querySelectorAll('.langs button').forEach(function (b) {
    b.onclick = function () { lang = b.dataset.lang; try { localStorage.setItem('rai_lang', lang); } catch (e) {} render(); };
  });

  function showErr(msg) { var e = $('#err'); e.textContent = msg; e.hidden = !msg; }
  $('#consent').addEventListener('change',function(){if(this.checked)showErr('');});
  $('#form').addEventListener('submit', function (ev) {
    ev.preventDefault(); if (!rating || sending) return;
    var t = T[lang], consent = $('#consent').checked, phone = $('#phone').value.trim();
    // Do not discard a submitted contact number when consent was missed.
    if (phone && !consent) {
      showErr(t.phoneConsentNeeded);
      $('#consent').focus();
      $('#consent').scrollIntoView({block:'center',behavior:'smooth'});
      return;
    }
    var cleanedPhone=phone.replace(/[^\d+]/g,'');
    if (consent && (!/^\+?[\d\s()\-]{7,20}$/.test(phone) || !/^\+?\d{7,15}$/.test(cleanedPhone))) {
      showErr(t.phoneBad); $('#phone').focus(); return;
    }
    showErr(''); sending = true; render();
    var prods = {}; Object.keys(votes).forEach(function (k) { if (votes[k]) prods[k] = votes[k]; });
    fetch('/api/public/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      submission_id: submissionId, browser_id: browserId, code: code, rating: rating, tags: Object.keys(chips).filter(function (k) { return chips[k]; }).concat(Object.keys(details).filter(function(k){return details[k];})),
      products: prods, comment: $('#comment').value, phone: consent ? cleanedPhone : '', phone_consent: consent, lang: lang,
      issued_at: cfg.issued_at, website: $('#website').value })
    }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        sending = false;
        if (x.s === 200 || x.s === 201 || x.s === 202) {
          $('#form').hidden = true; $('#thanks').hidden = false; var privacyFooter=document.querySelector('.foot'); if(privacyFooter) privacyFooter.hidden=true; window.scrollTo(0, 0); return;
        }
        render(); showErr(x.j && x.j.error === 'phone_consent_required' ? t.phoneConsentNeeded : x.j && x.j.error === 'invalid_phone' ? t.phoneBad : x.s === 429 ? (x.j.error === 'too_fast' ? t.errFast : t.errRate) : t.errGen);
      }).catch(function () { sending = false; render(); showErr(T[lang].errNet); });
  });

  render();
  if (!code) { $('#loading').hidden = true; $('#notfound').hidden = false; return; }
  fetch('/api/public/form/' + code).then(function (r) { if (!r.ok) throw new Error('nf'); return r.json(); })
    .then(function (j) { cfg = j; $('#loading').hidden = true; $('#form').hidden = false; render(); })
    .catch(function () { $('#loading').hidden = true; $('#notfound').hidden = false; });
})();
