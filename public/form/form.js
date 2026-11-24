(function () {
  'use strict';
  var T = {
    bg: { loading: 'Зареждане…', notfound: 'Този QR код не е активен. Моля, обърнете се към персонала.',
      title: 'Вашето мнение е важно за нас', lead: 'Отнема 10 секунди. Отговорите са анонимни.', q1: 'Оценете посещението си',
      low: 'Какво не беше наред?', high: 'Какво Ви хареса най-много?', q3: 'Опитахте ли нещо от новото меню?', q4: 'Искате ли да добавите нещо?', opt: 'по желание',
      ph4: 'Какво Ви хареса или какво да подобрим?', q5: 'Желаете ли да се свържем с Вас?',
      gdpr: 'Съгласявам се Рай да използва телефона ми само за връзка по този отзив.', privacy: 'Как пазим данните',
      send: 'Изпратете', hint: 'Изберете оценка, за да продължите.', hint2: 'Готово, можете да изпратите.', sending: 'Изпращане…',
      ty: 'Благодарим Ви!', ty2: 'Отзивът Ви беше изпратен на управителя.', google: 'Ако желаете, споделете и в Google',
      errNet: 'Няма връзка. Опитайте отново – отзивът няма да се дублира.', errRate: 'Получихме много отзиви от това устройство. Опитайте по-късно.',
      errFast: 'Моля, отделете няколко секунди и опитайте отново.', errGen: 'Нещо се обърка. Опитайте отново.', phoneBad: 'Проверете телефона или махнете отметката.',
      stars: ['', 'Много зле', 'Зле', 'Средно', 'Добре', 'Отлично'], starAria: 'звезди',
      lowc: { slow: 'Бавно обслужване', cold: 'Студена храна', wrong: 'Грешна поръчка', price: 'Цена', clean: 'Чистота', noise: 'Шум' },
      highc: { food: 'Храната', drinks: 'Напитките', staff: 'Персоналът', atmosphere: 'Атмосферата', music: 'Музиката', value: 'Цената' } },
    en: { loading: 'Loading…', notfound: 'This QR code is not active. Please ask our staff.',
      title: 'Your opinion matters to us', lead: 'Takes 10 seconds. Answers are anonymous.', q1: 'Rate your visit',
      low: 'What went wrong?', high: 'What did you like most?', q3: 'Did you try something from the new menu?', q4: 'Anything to add?', opt: 'optional',
      ph4: 'What did you like, or what should we improve?', q5: 'Would you like us to contact you?',
      gdpr: 'I agree that Rai may use my phone number only to contact me about this review.', privacy: 'How we keep your data',
      send: 'Send', hint: 'Choose a rating to continue.', hint2: 'Ready to send.', sending: 'Sending…',
      ty: 'Thank you!', ty2: 'Your feedback was sent to the manager.', google: 'If you like, share it on Google too',
      errNet: 'No connection. Please try again – your review will not be duplicated.', errRate: 'Too many reviews from this device. Please try later.',
      errFast: 'Please take a few seconds and try again.', errGen: 'Something went wrong. Please try again.', phoneBad: 'Check the phone number or untick the box.',
      stars: ['', 'Very bad', 'Bad', 'OK', 'Good', 'Excellent'], starAria: 'stars',
      lowc: { slow: 'Slow service', cold: 'Cold food', wrong: 'Wrong order', price: 'Price', clean: 'Cleanliness', noise: 'Noise' },
      highc: { food: 'The food', drinks: 'Drinks', staff: 'The staff', atmosphere: 'Atmosphere', music: 'Music', value: 'Price' } },
    el: { loading: 'Φόρτωση…', notfound: 'Αυτός ο κωδικός QR δεν είναι ενεργός. Ρωτήστε το προσωπικό.',
      title: 'Η γνώμη σας είναι σημαντική για εμάς', lead: 'Παίρνει 10 δευτερόλεπτα. Οι απαντήσεις είναι ανώνυμες.', q1: 'Αξιολογήστε την επίσκεψή σας',
      low: 'Τι δεν πήγε καλά;', high: 'Τι σας άρεσε περισσότερο;', q3: 'Δοκιμάσατε κάτι από το νέο μενού;', q4: 'Κάτι να προσθέσετε;', opt: 'προαιρετικά',
      ph4: 'Τι σας άρεσε ή τι να βελτιώσουμε;', q5: 'Θέλετε να επικοινωνήσουμε μαζί σας;',
      gdpr: 'Συμφωνώ το Rai να χρησιμοποιήσει το τηλέφωνό μου μόνο για επικοινωνία σχετικά με αυτή την αξιολόγηση.', privacy: 'Πώς προστατεύουμε τα δεδομένα',
      send: 'Αποστολή', hint: 'Επιλέξτε βαθμολογία για να συνεχίσετε.', hint2: 'Έτοιμο για αποστολή.', sending: 'Αποστολή…',
      ty: 'Ευχαριστούμε!', ty2: 'Η γνώμη σας στάλθηκε στον υπεύθυνο.', google: 'Αν θέλετε, μοιραστείτε το και στο Google',
      errNet: 'Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά – η αξιολόγηση δεν θα διπλασιαστεί.', errRate: 'Πολλές αξιολογήσεις από αυτή τη συσκευή. Δοκιμάστε αργότερα.',
      errFast: 'Περιμένετε λίγα δευτερόλεπτα και δοκιμάστε ξανά.', errGen: 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.', phoneBad: 'Ελέγξτε το τηλέφωνο ή αφαιρέστε την επιλογή.',
      stars: ['', 'Πολύ κακό', 'Κακό', 'Μέτριο', 'Καλό', 'Εξαιρετικό'], starAria: 'αστέρια',
      lowc: { slow: 'Αργή εξυπηρέτηση', cold: 'Κρύο φαγητό', wrong: 'Λάθος παραγγελία', price: 'Τιμή', clean: 'Καθαριότητα', noise: 'Θόρυβος' },
      highc: { food: 'Το φαγητό', drinks: 'Τα ποτά', staff: 'Το προσωπικό', atmosphere: 'Η ατμόσφαιρα', music: 'Η μουσική', value: 'Η τιμή' } }
  };
  var $ = function (s) { return document.querySelector(s); };
  var code = (location.pathname.match(/^\/r\/([A-Za-z0-9]{6,20})/) || [])[1];
  var langPref; try { langPref = localStorage.getItem('rai_lang'); } catch (e) {}
  var nav = (navigator.language || 'bg').slice(0, 2);
  var lang = T[langPref] ? langPref : (nav === 'el' ? 'el' : 'bg');
  var cfg = null, rating = 0, chips = {}, votes = {}, sending = false;
  var submissionId = uuid();
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
      b.onclick = function () { if (rating && (rating <= 3) !== (i <= 3)) chips = {}; rating = i; render(); };
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
      $('#q2').textContent = low ? t.low : t.high; c.innerHTML = '';
      Object.keys(list).forEach(function (k) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = list[k];
        b.setAttribute('aria-pressed', !!chips[k]); b.onclick = function () { chips[k] = !chips[k]; render(); }; c.appendChild(b);
      });
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
  $('#form').addEventListener('submit', function (ev) {
    ev.preventDefault(); if (!rating || sending) return;
    var t = T[lang], consent = $('#consent').checked, phone = $('#phone').value.trim();
    if (consent && !/^\+?[\d\s\-()]{7,20}$/.test(phone)) { showErr(t.phoneBad); return; }
    showErr(''); sending = true; render();
    var prods = {}; Object.keys(votes).forEach(function (k) { if (votes[k]) prods[k] = votes[k]; });
    fetch('/api/public/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      submission_id: submissionId, code: code, rating: rating, tags: Object.keys(chips).filter(function (k) { return chips[k]; }),
      products: prods, comment: $('#comment').value, phone: consent ? phone : '', phone_consent: consent, lang: lang,
      issued_at: cfg.issued_at, website: $('#website').value })
    }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        sending = false;
        if (x.s === 200 || x.s === 201 || x.s === 202) {
          var g = (x.j && x.j.google_review_url) || cfg.google_review_url;
          if (g) { $('#google').href = g; $('#google').hidden = false; }
          $('#form').hidden = true; $('#thanks').hidden = false; window.scrollTo(0, 0); return;
        }
        render(); showErr(x.s === 429 ? (x.j.error === 'too_fast' ? t.errFast : t.errRate) : t.errGen);
      }).catch(function () { sending = false; render(); showErr(T[lang].errNet); });
  });

  render();
  if (!code) { $('#loading').hidden = true; $('#notfound').hidden = false; return; }
  fetch('/api/public/form/' + code).then(function (r) { if (!r.ok) throw new Error('nf'); return r.json(); })
    .then(function (j) { cfg = j; $('#loading').hidden = true; $('#form').hidden = false; render(); })
    .catch(function () { $('#loading').hidden = true; $('#notfound').hidden = false; });
})();
