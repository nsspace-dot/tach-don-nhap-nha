/* Linh vật: chú mèo ôm chồng sách (SVG) + confetti nhẹ. */
(function (root) {
  'use strict';

  var LONG = '#f7c99b', VIEN = '#6b4a3a', TAI = '#f6a9a0', MA = '#f7a6a6';

  var MAT = {
    om: '<circle cx="82" cy="90" r="6.5" fill="' + VIEN + '"/><circle cx="118" cy="90" r="6.5" fill="' + VIEN + '"/>' +
        '<circle cx="84.5" cy="87.5" r="2.2" fill="#fff"/><circle cx="120.5" cy="87.5" r="2.2" fill="#fff"/>',
    vay: '<path d="M75 92 q7 -10 14 0 M111 92 q7 -10 14 0" fill="none" stroke="' + VIEN + '" stroke-width="4" stroke-linecap="round"/>',
    ngu: '<path d="M75 89 q7 8 14 0 M111 89 q7 8 14 0" fill="none" stroke="' + VIEN + '" stroke-width="3.5" stroke-linecap="round"/>',
    buon: '<circle cx="82" cy="91" r="6" fill="' + VIEN + '"/><circle cx="118" cy="91" r="6" fill="' + VIEN + '"/>' +
          '<circle cx="84" cy="89" r="2" fill="#fff"/><circle cx="120" cy="89" r="2" fill="#fff"/>' +
          '<path d="M72 80 l12 4 M128 80 l-12 4" stroke="' + VIEN + '" stroke-width="3" stroke-linecap="round"/>' +
          '<path d="M125 98 q4 8 0 11 q-4 -3 0 -11z" fill="#9fd3f5"/>'
  };
  var MIENG = {
    vui: '<path d="M93 103 q3.5 5 7 0 q3.5 5 7 0" fill="none" stroke="' + VIEN + '" stroke-width="3" stroke-linecap="round"/>',
    cuoi: '<path d="M92 102 q8 12 16 0z" fill="#e0716b" stroke="' + VIEN + '" stroke-width="2.5" stroke-linejoin="round"/>',
    buon: '<path d="M93 108 q7 -6 14 0" fill="none" stroke="' + VIEN + '" stroke-width="3" stroke-linecap="round"/>'
  };

  function sach(y, x, w, mau, gay) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="17" rx="5" fill="' + mau + '" stroke="' + VIEN + '" stroke-width="2.5"/>' +
      '<rect x="' + (x + 8) + '" y="' + (y + 5) + '" width="' + (w * 0.42) + '" height="3.5" rx="1.7" fill="' + gay + '"/>' +
      '<rect x="' + (x + w - 16) + '" y="' + (y + 3) + '" width="5" height="11" rx="2" fill="#fff" opacity=".7"/>';
  }

  /* mood: 'om' (ôm sách), 'ngu' (ngủ), 'vay' (vẫy tay, xong việc), 'buon' (lỗi) */
  function meo(mood) {
    mood = mood || 'om';
    var mat = MAT[mood] || MAT.om;
    var mieng = mood === 'buon' ? MIENG.buon : mood === 'vay' ? MIENG.cuoi : MIENG.vui;
    var vay = mood === 'vay';
    var s = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chú mèo ôm sách">';
    // bóng
    s += '<ellipse cx="100" cy="192" rx="66" ry="6" fill="#000" opacity=".07"/>';
    // đuôi
    s += '<path class="meo-duoi" d="M146 172 q34 -6 30 -40 q-2 -14 -12 -12 q-8 2 -2 12 q6 18 -18 26" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3" stroke-linejoin="round"/>';
    // thân
    s += '<ellipse cx="100" cy="150" rx="46" ry="38" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3"/>';
    s += '<ellipse cx="100" cy="152" rx="26" ry="24" fill="#fff3e6"/>';
    // tai
    s += '<path d="M62 70 L64 30 L94 54 Z" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3" stroke-linejoin="round"/>';
    s += '<path d="M138 70 L136 30 L106 54 Z" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3" stroke-linejoin="round"/>';
    s += '<path d="M68 60 L69 40 L84 53 Z M132 60 L131 40 L116 53 Z" fill="' + TAI + '"/>';
    // đầu
    s += '<ellipse cx="100" cy="88" rx="46" ry="38" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3"/>';
    s += '<path d="M90 52 q2 8 0 14 M100 50 q2 9 0 16 M110 52 q2 8 0 14" stroke="#e9a76a" stroke-width="3" fill="none" stroke-linecap="round"/>';
    s += mat;
    s += '<ellipse cx="68" cy="102" rx="8" ry="5" fill="' + MA + '" opacity=".75"/><ellipse cx="132" cy="102" rx="8" ry="5" fill="' + MA + '" opacity=".75"/>';
    s += '<path d="M96 97 h8 l-4 4z" fill="#e0716b" stroke="' + VIEN + '" stroke-width="1.5" stroke-linejoin="round"/>';
    s += mieng;
    s += '<path d="M58 96 h-16 M58 102 l-15 4 M142 96 h16 M142 102 l15 4" stroke="' + VIEN + '" stroke-width="2" stroke-linecap="round" opacity=".6"/>';
    // chồng sách (màu 3 nhà)
    s += sach(170, 52, 96, '#f9d5cc', '#e9a291');
    s += sach(153, 58, 84, '#cdefe0', '#8fd3b5');
    s += sach(136, 50, 92, '#fbebb5', '#ecd06a');
    // chân ôm sách
    s += '<ellipse cx="74" cy="137" rx="12" ry="9" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3"/>';
    if (vay) {
      s += '<g class="meo-vay"><path d="M136 132 q18 -16 22 -38" stroke="' + VIEN + '" stroke-width="20" stroke-linecap="round" fill="none"/>' +
           '<path d="M136 132 q18 -16 22 -38" stroke="' + LONG + '" stroke-width="14" stroke-linecap="round" fill="none"/>' +
           '<circle cx="158" cy="92" r="11" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3"/>' +
           '<circle cx="158" cy="94" r="4" fill="' + TAI + '"/></g>';
    } else {
      s += '<ellipse cx="126" cy="137" rx="12" ry="9" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3"/>';
    }
    if (mood === 'ngu') {
      s += '<g class="meo-z" fill="#b9a3e6" font-family="Baloo 2, Arial" font-weight="700"><text x="148" y="46" font-size="22">z</text><text x="166" y="28" font-size="16">z</text></g>';
    }
    if (vay) {
      s += '<g fill="#f6a77d"><path d="M30 60 l4 -9 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4z"/></g><g fill="#b9a3e6"><path d="M172 150 l3 -6 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3z"/></g>';
    }
    return s + '</svg>';
  }

  var MAU_GIAY = ['#f9d5cc', '#cdefe0', '#fbebb5', '#e3d9f5', '#ffd8c2', '#e98a74', '#8fd3b5', '#b9a3e6'];

  function confetti(host) {
    if (!host || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    host.innerHTML = '';
    for (var i = 0; i < 46; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = MAU_GIAY[i % MAU_GIAY.length];
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      p.style.animationDuration = (1.8 + Math.random() * 1.2) + 's';
      p.style.transform = 'rotate(' + (Math.random() * 180) + 'deg)';
      host.appendChild(p);
    }
    setTimeout(function () { host.innerHTML = ''; }, 3500);
  }

  root.LinhVat = { meo: meo, confetti: confetti };
})(typeof self !== 'undefined' ? self : this);
