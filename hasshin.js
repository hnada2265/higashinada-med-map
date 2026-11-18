// 稼働状況マップ 発信ページ（v2.11・2026-11-18）
// 画面だけをここ（GitHub Pages）に置き、処理は医師会の Apps Script が行う。
// - Apps Script の URL はこのファイルに書かない。理事会LINEノートのリンクの「#k=…」で受け取る
// - 合言葉は送るだけで、このページには保存しない
// - サーバーから来た文字は textContent でだけ表示する（HTMLとして解釈しない）
(function () {
  'use strict';
  // 他のサイトに埋め込まれていたら何も表示しない（なりすまし画面への埋め込み対策）
  if (window.top !== window.self) { document.body.textContent = ''; return; }

  var $ = function (id) { return document.getElementById(id); };
  var m = /(?:^#|&)k=(AKfycb[A-Za-z0-9_-]{20,200})(?:&|$)/.exec(location.hash || '');
  if (!m) { $('nokey').hidden = false; return; }
  var API = 'https://script.google.com/macros/s/' + m[1] + '/exec';
  $('app').hidden = false;
  $('fallback').href = API;

  function show(el, text) { el.textContent = text || ''; el.hidden = !text; }
  function clearErrors() { show($('errTop')); show($('err1')); show($('err2')); }

  function load() {
    return fetch(API + '?api=status', { method: 'GET', redirect: 'follow', credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        $('loading').hidden = true;
        if (!s || !s.ok) { show($('errTop'), (s && s.err) || '読み込みに失敗しました。'); return; }
        $('cnt').textContent = s.n;
        var rs = s.recips || [];
        $('rc').textContent = rs.length;
        $('recipShort').textContent = rs.length ? rs[0] + (rs.length > 1 ? ' ほか' + (rs.length - 1) + '宛先' : '') : '（宛先なし）';
        var tb = $('recipList'); tb.textContent = '';
        rs.forEach(function (x) { var tr = tb.insertRow(); tr.insertCell().textContent = x; });
        $('btn2').disabled = !rs.length;
        $('subj').textContent = s.mail.subject;
        $('mbody').textContent = s.mail.body;
        var L = s.limits;
        $('rules').textContent = '合言葉を ' + L.pinMaxFails + ' 回続けて間違えると ' + L.pinLockMin + ' 分間使えません。' +
          '連絡メールは ' + L.cooldownMin + ' 分に1回・24時間に ' + L.maxPerDay + ' 回まで。いつ誰が送ったかは「発信記録」に残ります。';
      })
      .catch(function () {
        $('loading').hidden = true;
        show($('errTop'), '発信の仕組みにつながりません。電波を確かめて開き直すか、下の「予備のページ」をお使いください。');
      });
  }

  function post(body, btn) {
    clearErrors();
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = '送信中…';
    body.api = 1;
    // text/plain で送る（事前確認の通信が要らない形。合言葉は本文で送り、URLには載せない）
    return fetch(API, { method: 'POST', redirect: 'follow', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .finally(function () { btn.disabled = false; btn.textContent = label; });
  }

  function done(kind, n, k) {
    var stamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    var b = $('banner'); b.textContent = '';
    var t = document.createElement('b');
    var w = document.createElement('span'); w.className = 'when'; w.textContent = stamp;
    var p = document.createElement('div');
    if (kind === 'reset') {
      t.textContent = '✅ ① リセットが終わりました';
      p.textContent = '報告 ' + n + ' 件を「報告履歴」へ退避し、全機関を「⚪未回答」に戻しました。続けて下の「② 連絡」へ進んでください。';
      $('s1').className = 'step donestep'; $('f1').className = 'fin'; $('f2').className = 'cur';
    } else {
      t.textContent = '✅ ② 連絡メールを送りました';
      p.textContent = '報告のお願いメール（' + (k === 'honban' ? '本番' : '訓練') + '）を ' + n + ' 宛先へ送信しました。LINE（オープンチャット・理事会LINE）への掲示は別途お願いします。';
      $('s2').className = 'step donestep'; $('f1').className = 'fin'; $('f2').className = 'fin';
    }
    b.appendChild(t); b.appendChild(w); b.appendChild(p); b.hidden = false;
    b.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fail(res, step) {
    var msg = (res && res.err) || 'エラーが発生しました。';
    show(step === 'send' ? $('err2') : step === 'reset' ? $('err1') : $('errTop'), msg);
  }

  var netErr = '通信できませんでした。結果が分からないので、続けて押す前に「発信記録」か受信メールを確かめてください（予備のページも使えます）。';

  $('form1').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pin = $('pin1').value; $('pin1').value = '';
    post({ action: 'reset', pin: pin }, ev.submitter || this.querySelector('button'))
      .then(function (r) { if (r.ok && r.done === 'reset') { done('reset', r.n); load(); } else fail(r, 'reset'); })
      .catch(function () { show($('err1'), netErr); });
  });

  $('form2').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var k = (this.querySelector('input[name=kind]:checked') || {}).value || '';
    var pin = $('pin2').value; $('pin2').value = '';
    post({ action: 'send', pin: pin, kind: k, sender: $('sender').value, note: $('note').value,
      confirm: $('confirm').checked ? '1' : '' }, $('btn2'))
      .then(function (r) {
        if (r.ok && r.done === 'send') { $('confirm').checked = false; done('send', r.n, r.kind); }
        else fail(r, 'send');
      })
      .catch(function () { show($('err2'), netErr); });
  });

  load();
})();
