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

  /* Phụ kiện theo chủ đề giao diện: sau = vẽ phía sau mèo, truoc = vẽ đè lên */
  var PHU_KIEN = {
    // 📦 ngồi trong thùng carton, đội nón giao hàng
    'buu-kien': {
      truoc: '<path d="M22 114 l18 16 h120 l18 -16 l-10 -4 l-14 18 h-108 l-14 -18z" fill="#d6a66c" stroke="' + VIEN + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M40 130 h120 l-6 64 h-108z" fill="#c9965c" stroke="' + VIEN + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<rect x="91" y="130" width="18" height="64" fill="#efdcae" opacity=".9"/>' +
        '<rect x="52" y="148" width="30" height="20" rx="2" fill="#fffaf0" stroke="' + VIEN + '" stroke-width="2"/>' +
        '<path d="M56 154 h22 M56 160 h16" stroke="#b8402c" stroke-width="2"/>' +
        '<path d="M126 150 l14 0 M126 158 l20 0" stroke="#8a6438" stroke-width="2" stroke-dasharray="3 3"/>' +
        '<ellipse cx="72" cy="130" rx="12" ry="8" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3"/>' +
        '<ellipse cx="128" cy="130" rx="12" ry="8" fill="' + LONG + '" stroke="' + VIEN + '" stroke-width="3"/>' +
        '<path d="M64 62 q36 -40 72 0z" fill="#2f5aa8" stroke="' + VIEN + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M60 64 q40 -8 80 0 q14 2 22 8 q-14 6 -30 0 q-36 -6 -72 0z" fill="#244a8c" stroke="' + VIEN + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<circle cx="100" cy="47" r="7" fill="#ffd34d" stroke="' + VIEN + '" stroke-width="2"/>',
      anTay: true
    },
    // 📒 đeo cặp sách, cầm bút chì
    'so-tay': {
      sau: '<rect x="40" y="112" width="36" height="54" rx="10" fill="#2f5bd3" stroke="' + VIEN + '" stroke-width="3" transform="rotate(-12 58 139)"/>',
      truoc: '<path d="M76 116 q-10 30 0 62 M124 116 q10 30 0 62" stroke="#2f5bd3" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<g transform="rotate(32 150 120)"><rect x="144" y="70" width="11" height="58" rx="2" fill="#ffd34d" stroke="' + VIEN + '" stroke-width="2.5"/>' +
        '<rect x="144" y="64" width="11" height="9" rx="2" fill="#f49ab0" stroke="' + VIEN + '" stroke-width="2.5"/>' +
        '<path d="M144 128 l5.5 14 l5.5 -14z" fill="#f7dcb5" stroke="' + VIEN + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M147.5 137 l2 5 l2 -5z" fill="' + VIEN + '"/></g>'
    },
    // 📚 đeo kính, ngồi trên kệ sách
    'thu-vien': {
      sau: '<rect x="6" y="56" width="22" height="130" rx="2" fill="#8b5a2b" opacity=".9"/><rect x="172" y="70" width="20" height="116" rx="2" fill="#6b4a3a" opacity=".85"/>' +
        '<rect x="160" y="100" width="12" height="86" rx="2" fill="#a8743e"/><rect x="28" y="96" width="12" height="90" rx="2" fill="#c49a6c"/>',
      truoc: '<circle cx="82" cy="90" r="13" fill="#fff" fill-opacity=".18" stroke="' + VIEN + '" stroke-width="3.5"/>' +
        '<circle cx="118" cy="90" r="13" fill="#fff" fill-opacity=".18" stroke="' + VIEN + '" stroke-width="3.5"/>' +
        '<path d="M95 89 q5 -4 10 0 M69 88 l-12 -4 M131 88 l12 -4" stroke="' + VIEN + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<rect x="0" y="186" width="200" height="12" rx="2" fill="#7a4a22" stroke="' + VIEN + '" stroke-width="2"/>'
    },
    // 🌙 ngủ trên chồng sách dưới đèn bàn
    'dem': {
      sau: '<path d="M150 64 L112 196 L200 196 L196 64z" fill="#ffd77a" opacity=".16"/>',
      truoc: '<path d="M186 196 v-6 h-26 v6z" fill="#3b4a6b" stroke="' + VIEN + '" stroke-width="2.5"/>' +
        '<path d="M173 190 L182 110 L160 72" stroke="#3b4a6b" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M140 76 L162 54 L186 78 Q166 92 140 76z" fill="#f2b84b" stroke="' + VIEN + '" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<ellipse cx="160" cy="84" rx="8" ry="4" fill="#fff6c8"/>',
      ngu: true
    }
  };
  function chuDe() { try { return document.documentElement.getAttribute('data-chu-de') || ''; } catch (e) { return ''; } }

  /* mood: 'om' (ôm sách), 'ngu' (ngủ), 'vay' (vẫy tay, xong việc), 'buon' (lỗi) – phụ kiện theo chủ đề đang chọn */
  function meo(mood) {
    mood = mood || 'om';
    var pk = PHU_KIEN[chuDe()] || {};
    if (pk.ngu && mood === 'om') mood = 'ngu';
    var mat = MAT[mood] || MAT.om;
    var mieng = mood === 'buon' ? MIENG.buon : mood === 'vay' ? MIENG.cuoi : MIENG.vui;
    var vay = mood === 'vay';
    var s = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chú mèo ôm sách">' + (pk.sau || '');
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
    return s + (pk.truoc || '') + '</svg>';
  }

  /* Hiệu ứng đóng dấu (chủ đề Bưu kiện: "ĐÃ GỬI", Thư viện cũ: "ĐÃ ĐẶT") – chủ đề khác không làm gì */
  var CHU_DAU = { 'buu-kien': 'ĐÃ GỬI', 'thu-vien': 'ĐÃ ĐẶT' };
  function dongDau(chu) {
    var t = chu || CHU_DAU[chuDe()];
    if (!t || !CHU_DAU[chuDe()]) return;
    var el = document.createElement('div');
    el.className = 'dong-dau';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = t;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1700);
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

  root.LinhVat = { meo: meo, confetti: confetti, dongDau: dongDau };
})(typeof self !== 'undefined' ? self : this);
