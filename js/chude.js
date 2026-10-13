/* Chủ đề giao diện: mỗi máy tự chọn (localStorage), đổi ngay không cần tải lại trang.
 * Màu / font / viền / nền nằm trong themes.css (biến CSS). Thêm chủ đề: thêm 1 dòng vào CHU_DE + 1 khối trong themes.css. */
(function (root) {
  'use strict';
  var LS = 'tdn.chude.v1';
  var CHU_DE = [
    { id: '', ten: '🐱 Mèo pastel', mota: 'Giao diện mặc định' },
    { id: 'buu-kien', ten: '📦 Bưu kiện', mota: 'Giấy kraft, thùng carton, tem bưu điện, con dấu',
      font: 'family=Roboto+Slab:wght@500;700&family=Roboto+Mono:wght@500;700' },
    { id: 'so-tay', ten: '📒 Sổ tay học trò', mota: 'Giấy ô li, mực bút bi xanh, nhãn vở', font: 'family=Patrick+Hand' },
    { id: 'thu-vien', ten: '📚 Thư viện cũ', mota: 'Giấy ngà, mực nâu, thẻ mượn sách', font: 'family=Lora:ital,wght@0,500;0,700;1,600' },
    { id: 'dem', ten: '🌙 Đêm đọc sách', mota: 'Nền tối xanh đêm, ánh đèn bàn – đỡ mỏi mắt' }
  ];
  function hienTai() { try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; } }
  function napFont(cd) {
    if (!cd || !cd.font || document.getElementById('font-cd-' + cd.id)) return;
    var l = document.createElement('link');
    l.id = 'font-cd-' + cd.id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?' + cd.font + '&display=swap';
    document.head.appendChild(l);
  }
  function apDung(id) {
    var cd = CHU_DE.filter(function (x) { return x.id === id; })[0] || CHU_DE[0];
    if (cd.id) document.documentElement.setAttribute('data-chu-de', cd.id);
    else document.documentElement.removeAttribute('data-chu-de');
    napFont(cd);
    return cd;
  }
  /* Đổi chủ đề: lưu + vẽ lại mèo ở thanh trên, ô thả file, màn trống, kết quả */
  function doi(id) {
    try { localStorage.setItem(LS, id); } catch (e) { /* bỏ qua */ }
    apDung(id);
    var LV = root.LinhVat;
    if (!LV) return;
    [['brand-cat', 'om'], ['drop-cat', 'om'], ['empty-cat', 'ngu'], ['xong-cat', 'vay']].forEach(function (x) {
      var el = document.getElementById(x[0]);
      if (el && (x[0] !== 'xong-cat' || el.innerHTML)) el.innerHTML = LV.meo(x[1]);
    });
  }
  apDung(hienTai()); // chạy ngay khi tải script (đặt trong <head>) để không bị nháy màu
  root.ChuDe = { DS: CHU_DE, hienTai: hienTai, doi: doi };
})(typeof self !== 'undefined' ? self : this);
