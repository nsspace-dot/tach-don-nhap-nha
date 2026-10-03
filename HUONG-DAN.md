# Hướng dẫn cài đặt & sử dụng "Tách đơn nhập nhà" 🐱📚

App giúp lọc file đơn hàng **Shopee** + **TikTok** thành danh sách nhập hàng cho 3 nhà:
**Hồng Ân (HA)** · **Khang Việt (KV)** · **Minh Long (ML)**, rồi xuất 1 file Excel 5 sheet.

- File đơn hàng chỉ được đọc **trên máy của bạn**, không gửi lên đâu cả.
- Phần "trí nhớ" (SKU nào thuộc nhà nào, combo gồm những cuốn nào) lưu trên **Google Sheets** để mọi máy dùng chung.

> Giao diện Google có thể hiện tiếng Việt hoặc tiếng Anh. Hướng dẫn ghi cả hai, ví dụ: **Triển khai (Deploy)**.

---

## Phần A. Tạo file Google Sheets làm danh mục (làm 1 lần)

1. Vào <https://sheets.google.com>, đăng nhập tài khoản Google của shop.
2. Bấm **Trống (Blank)** để tạo file mới. Đặt tên, ví dụ: `Danh muc - Tach don nhap nha`.
3. Chỉnh múi giờ để giờ trong lịch sử đúng giờ Việt Nam:
   **Tệp (File) → Cài đặt (Settings) → Múi giờ (Time zone)** → chọn **(GMT+07:00) Ho Chi Minh** → **Lưu**.

> Không cần tự tạo sheet con – bước B sẽ tự tạo.

## Phần B. Dán Apps Script (làm 1 lần)

1. Trong file Google Sheets vừa tạo, bấm **Tiện ích mở rộng (Extensions) → Apps Script**.
2. Một tab mới mở ra, có sẵn file `Code.gs` với vài dòng `function myFunction() {}`. **Xóa hết** các dòng đó.
3. Mở file [`apps-script/Code.gs`](apps-script/Code.gs) trong repo này → bấm nút **Copy raw file** (biểu tượng 2 tờ giấy) → quay lại tab Apps Script → **dán** vào.
4. Bấm biểu tượng **💾 Lưu (Save)**.
5. Chỉnh múi giờ của script: bấm **⚙️ Cài đặt dự án (Project Settings)** ở cột trái → **Múi giờ (Time zone)** → **(GMT+07:00) Ho Chi Minh**.
6. Quay lại **<> Trình chỉnh sửa (Editor)**. Ở thanh trên cùng, ô chọn hàm (cạnh nút **▶ Chạy / Run**) → chọn **`khoiTao`** → bấm **▶ Chạy (Run)**.
7. Lần đầu Google sẽ hỏi quyền:
   - **Xem xét quyền (Review permissions)** → chọn tài khoản của bạn.
   - Nếu thấy *"Google chưa xác minh ứng dụng này" (Google hasn't verified this app)*: bấm **Nâng cao (Advanced)** → **Đi tới … (không an toàn) / Go to … (unsafe)** → **Cho phép (Allow)**.
     (Đây là script của chính bạn nên an toàn.)
8. Quay lại tab Google Sheets: sẽ thấy 4 sheet **SKU_NHA**, **COMBO**, **COMBO_THANH_PHAN**, **LICH_SU**. ✅

> ⚠️ Không đổi tên, không đổi thứ tự cột của 4 sheet này. Muốn sửa danh mục thì nên sửa trong app (để có lịch sử).
> Sheet **LICH_SU** chỉ được thêm dòng – đừng xóa dòng trong đó.

## Phần C. Bật sao lưu tự động mỗi ngày (làm 1 lần)

Mỗi tối khoảng **23h**, script tự chép 3 sheet danh mục sang 1 file riêng tên
**"Sao lưu danh mục – Tách đơn nhập nhà"** (nằm trong Google Drive của bạn), giữ **30 ngày gần nhất**.

**Cách 1 (dễ nhất):**
1. Trong tab Apps Script, ô chọn hàm → chọn **`caiDatSaoLuuTuDong`** → **▶ Chạy**.
2. Chạy xong, script sao lưu ngay 1 bản đầu tiên. Vào Google Drive sẽ thấy file sao lưu, bên trong có 3 sheet tên dạng `2026-10-03 SKU_NHA`, `2026-10-03 COMBO`, `2026-10-03 COMBO_THANH_PHAN`.
3. Kiểm tra: bấm biểu tượng **⏰ Trình kích hoạt (Triggers)** ở cột trái → thấy 1 dòng `saoLuuHangNgay` – *Theo thời gian (Time-based)*. ✅

**Cách 2 (tự tạo bằng tay, nếu cách 1 lỗi):**
1. Bấm **⏰ Trình kích hoạt (Triggers)** → **+ Thêm trình kích hoạt (Add Trigger)** (góc dưới phải).
2. Chọn:
   - Hàm sẽ chạy: **`saoLuuHangNgay`**
   - Nguồn sự kiện: **Theo thời gian (Time-driven)**
   - Loại: **Bộ hẹn giờ theo ngày (Day timer)**
   - Giờ: **11 giờ tối đến nửa đêm (11pm to midnight)**
3. Bấm **Lưu**.

> Chỉ cài **một** trong 2 cách. Chạy lại `caiDatSaoLuuTuDong` nhiều lần cũng không bị trùng.

### Khi cần khôi phục danh mục từ bản sao lưu
1. Mở file sao lưu, xem tên sheet để chọn ngày muốn lấy lại (ví dụ `2026-10-01`).
2. Trong Apps Script, tìm dòng `var NGAY_KHOI_PHUC = '…';` (gần cuối file) → sửa thành ngày đó → **💾 Lưu**.
3. Chọn hàm **`khoiPhucSaoLuu`** → **▶ Chạy**.
4. Trước khi khôi phục, script tự lưu thêm 1 bản danh mục hiện tại (tên có chữ `truoc-khoi-phuc`) – lỡ chọn nhầm ngày vẫn lấy lại được.
   Việc khôi phục cũng được ghi vào sheet **LICH_SU**.

## Phần D. Triển khai (Deploy) thành Web App để app gọi được (làm 1 lần)

1. Trong tab Apps Script, bấm nút xanh **Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)**.
2. Bấm biểu tượng ⚙️ cạnh *Chọn loại (Select type)* → chọn **Ứng dụng web (Web app)**.
3. Điền:
   - Mô tả: `Tach don nhap nha`
   - **Thực thi với tư cách (Execute as): Tôi (Me)**
   - **Người có quyền truy cập (Who has access): Bất kỳ ai (Anyone)**
4. Bấm **Triển khai (Deploy)** → nếu hỏi quyền thì cho phép như bước B.7.
5. Copy **URL ứng dụng web (Web app URL)** – dạng `https://script.google.com/macros/s/AKfy…/exec`.

> 🔐 **Giữ kín URL này.** App không dùng mã PIN, nên **ai có URL đều đọc/sửa được danh mục**.
> - Chỉ dán URL vào màn **Cài đặt** của app trên máy công ty.
> - **Tuyệt đối không** dán URL vào code, vào GitHub (repo đang public), nhóm chat đông người…
> - Nếu lỡ lộ URL: **Triển khai → Quản lý các bản triển khai (Manage deployments)** → bấm **Lưu trữ (Archive)** bản cũ → tạo **New deployment** mới (URL mới) → dán URL mới vào Cài đặt từng máy. Nếu danh mục bị phá, xem lại sheet **LICH_SU** và khôi phục theo Phần C.

**Khi cập nhật `Code.gs` sau này (giữ nguyên URL) – ⚠️ làm mỗi khi có bản `Code.gs` mới:**
dán code mới → 💾 Lưu → **Triển khai → Quản lý các bản triển khai** → bấm ✏️ **Chỉnh sửa** → *Phiên bản (Version)*: **Phiên bản mới (New version)** → **Triển khai**.
(Nếu tạo *New deployment* thì sẽ ra URL khác.)

## Phần E. Đưa app lên GitHub Pages (làm 1 lần)

App là trang web tĩnh, GitHub Pages host miễn phí.

1. Code app cần nằm ở nhánh chính **`main`** của repo `tach-don-nhap-nha`.
   (Code đang ở nhánh `claude/compassionate-ride-gv8h03` – cần gộp vào `main` qua Pull Request, hoặc ở bước 3 chọn tạm nhánh này.)
2. Vào repo trên GitHub → **Settings** → cột trái chọn **Pages**.
3. Mục **Build and deployment**:
   - *Source*: **Deploy from a branch**
   - *Branch*: **main** – thư mục **/ (root)** → **Save**.
4. Đợi 1–2 phút, tải lại trang Settings → Pages sẽ hiện link dạng
   `https://<tên-tài-khoản>.github.io/tach-don-nhap-nha/` → mở link đó là thấy app. 🎉

> Repo public nhưng **không chứa dữ liệu khách**: các file đơn hàng (`.xlsx`) bị chặn bởi `.gitignore`; URL Apps Script chỉ lưu trên từng máy.

## Phần F. Dán URL vào app (làm 1 lần trên mỗi máy)

1. Mở app → bấm **⚙️ Cài đặt**.
2. Dán URL ở Phần D vào ô **URL Apps Script**.
3. Bấm **🔌 Kiểm tra kết nối** → thấy *"✅ Đọc được danh mục … Ghi được – sẵn sàng dùng 🎉"* là xong.
4. Góc trên phải hiện chấm xanh **"Đã đồng bộ"**.

> URL được lưu trong trình duyệt của máy đó. Đổi máy / đổi trình duyệt / xóa dữ liệu duyệt web thì phải dán lại.

## Phần G. Mở app nhanh như phần mềm trên máy bàn

Trong **Chrome** hoặc **Edge**, mở link app rồi:
- **Chrome:** menu ⋮ → **Truyền, lưu và chia sẻ (Cast, save and share)** → **Tạo lối tắt (Create shortcut)** → tick **Mở dưới dạng cửa sổ (Open as window)** → **Tạo**.
- **Edge:** menu … → **Ứng dụng (Apps)** → **Cài đặt trang web này dưới dạng ứng dụng (Install this site as an app)**.

Ngoài màn hình Desktop sẽ có biểu tượng để mở app trong cửa sổ riêng.

---

## Sử dụng hằng ngày

1. Xuất file đơn chờ giao:
   - **Shopee:** Đơn hàng → Chờ lấy hàng → **Xuất** (file có sheet `orders`).
   - **TikTok:** Đơn hàng → Chờ vận chuyển → **Xuất** (file có sheet `OrderSKUList`).
   - Có nhiều gian hàng thì xuất mỗi gian 1 file.
2. Mở app → **kéo thả** tất cả file vào ô có chú mèo (hoặc bấm **Chọn file**). Thả thêm file lúc nào cũng được.
   - Mỗi file hiện 1 chip: sàn, tên file, **số đơn mới**, số dòng.
   - **Chống cộng trùng:** nếu file sau có đơn (cùng mã đơn) đã có ở file trước → đơn đó bị bỏ qua, chip ghi *"bỏ qua n đơn trùng"*.
     Trong cùng 1 file, 1 đơn nhiều sản phẩm vẫn tính đủ.
   - Bấm **×** trên chip để gỡ file đó ra, app tự tính lại.
3. Xem 5 thẻ: **Hồng Ân · Khang Việt · Minh Long · Combo · Chưa rõ nhà** (bấm thẻ để xem chi tiết).
4. Xử lý các tab cần chú ý:
   - **Chưa rõ nhà:** bấm **HA / KV / ML / Không nhập** cho từng dòng → app nhớ cho lần sau.
   - **Combo:**
     - **🧩 Khai báo thành phần:** nhập từng cuốn trong combo (SKU, tên, nhà, giá gốc, số lượng mỗi combo). Gõ SKU đã biết thì app tự điền tên/nhà/giá. Sách nhà khác trong combo trộn thì chọn nhà **Khác** (sẽ không nhập).
     - **🔗 Đây là combo đã có:** cùng 1 combo nhưng sàn khác đặt mã khác → chọn combo có sẵn để gắn thêm mã.
     - **📦 Xuất nguyên combo:** dùng cho sách mà hệ thống lên đơn của shop **chỉ có dạng combo**, không có từng cuốn lẻ.
       Chọn **Nhà**, có thể điền **Mã trên hệ thống** (mã combo trên website lên đơn; để trống = dùng SKU của sàn) và **Tên xuất** (để trống = tên combo đã làm gọn).
       Không cần nhập thành phần. File Excel sẽ có **1 dòng** cho combo đó trong sheet nhà: giá gốc = giá combo trên sàn, số lượng = số combo (cộng cả 2 sàn nếu đã gắn mã của cả 2 sàn).
       Combo **trộn nhà khác** (có MEGA, TN…) thì không chọn được "Xuất nguyên" – phải tách để chỉ lấy phần HA/KV/ML.
     - Khai báo xong, combo tự tách thành từng cuốn và cộng vào sheet nhà – không cần thả file lại.
   - **🙈 Đã bỏ qua:** lịch, tranh, trà… và sách nhà khác. Nếu bị bỏ nhầm thì chọn lại nhà ở cột cuối.
5. Bấm **⬇️ Tải file Excel** → được file `Don-nhap-nha_dd-mm-yyyy.xlsx`:

| Sheet | Nội dung |
|---|---|
| Hồng Ân / Khang Việt / Minh Long | SKU, Tên, Giá gốc, Số lượng – đã cộng cả 2 sàn và phần tách từ combo |
| Combo | Combo chưa khai báo (cần khai báo để lần sau tự tách) |
| Chưa rõ nhà | Dòng chưa biết nhà |

**Tên sản phẩm trong file Excel được làm gọn:** bỏ phần loại sách ở đầu ("Sách -", "Sách Tham Khảo -"…) và phần mã nhà, tên shop, tác giả ở cuối ("- HA - Newshop", "(HA)", "- KV - Tác Giả …"). Ví dụ
"Sách Tham Khảo - Hướng Dẫn Giải Bài Tập Toán Lớp 3 (Dùng Kèm SGK Kết Nối) - HA - Newshop" → "Hướng Dẫn Giải Bài Tập Toán Lớp 3 (Dùng Kèm SGK Kết Nối)".
Trên màn hình app cũng hiện tên gọn; **rê chuột vào tên** để xem tên gốc. Dữ liệu gốc và danh mục không bị đổi.

Ý nghĩa màu trong file Excel:
- 🟧 **Ô SKU màu cam:** SKU trống hoặc không phải mã vạch – app nhận diện bằng tên + phân loại.
- 🟨 **Cả dòng màu vàng:** cùng SKU nhưng giá gốc khác nhau (để 2 dòng riêng cho bạn kiểm tra).

### Mèo tự học 🐾
Mỗi lần tách đơn, sách lẻ có mã vạch và có đúng 1 mã nhà trong tên (vd "… - HA - Newshop") sẽ được tự ghi vào danh mục (nguồn **tự học**).
Lần sau nếu tên sách thiếu mã nhà, app vẫn nhận ra. Những gì bạn **gán tay** luôn được ưu tiên – tự học không bao giờ ghi đè.

## Màn Danh mục

- **SKU → nhà:** tìm kiếm (gõ không dấu cũng được), đổi nhà, xóa (có hỏi lại).
- **Combo:** xem thành phần, cột **Cách xuất** (✂️ Tách / 📦 Nguyên combo – đổi qua lại ngay tại đây), **✏️ Sửa**, xóa (hiện rõ tên combo và các thành phần trước khi xóa).
  - Combo có SKU là **mã vạch** (vd dòng Shopee "Hiragana (HA)" phân loại COMBO.HA) được nhận diện bằng mã vạch **kèm phân loại** (`sku:8935092825724|combo.ha`), để không nhầm với cuốn lẻ cùng mã vạch. Combo khai báo trước đây bằng mã vạch trơn sẽ **tự đổi sang khóa mới** lần đầu bạn thả file có combo đó (có ghi Lịch sử).
- **🕘 Lịch sử:** 100 thay đổi gần nhất (ai gán nhà, tự học, lưu/xóa combo…), có dữ liệu trước và sau. Bản đầy đủ ở sheet **LICH_SU**.
- **📤 Xuất danh mục ra Excel:** sao lưu thủ công về máy.
- **📥 Nạp từ Excel:** nạp hàng loạt. Bấm **📄 Tải file mẫu** (hoặc dùng [`templates/mau-nap-danh-muc.xlsx`](templates/mau-nap-danh-muc.xlsx)), đọc sheet `HUONG_DAN` trong file, điền rồi nạp. File xuất ở trên cũng nạp lại được.

## Màn Cài đặt

- **URL Apps Script** (xem Phần D, F).
- **Mã nhà khác:** các mã sẽ bị bỏ qua (mặc định `MEGA, VT, HH, NS, QB, TN, HT`). Có nhà mới thì thêm vào, cách nhau dấu phẩy.
- **Kiểm tra kết nối.**

---

## Gặp sự cố?

| Hiện tượng | Cách xử lý |
|---|---|
| Chấm đỏ **"Lỗi kết nối"** | Kiểm tra mạng. Bấm vào chấm để thử lại. App vẫn chạy bằng danh mục đã lưu trên máy. |
| *"URL không trả về dữ liệu danh mục"* | Dán sai link (phải là link `/exec`), hoặc lúc Deploy chưa chọn **Bất kỳ ai (Anyone)**. |
| *"Hành động không hợp lệ"* sau khi cập nhật app | Chưa cập nhật `Code.gs` mới hoặc chưa tạo **Phiên bản mới** khi triển khai (xem Phần D). |
| File không nhận | Phải là file `.xlsx` gốc xuất từ Shopee/TikTok, đừng mở ra sửa rồi lưu lại dạng khác. |
| *"Đang có máy khác ghi danh mục"* | 2 máy cùng lưu một lúc – đợi vài giây bấm lại. |
| Lỡ xóa / sửa sai danh mục | Xem tab **🕘 Lịch sử** để biết dữ liệu cũ và sửa lại; hoặc khôi phục cả danh mục theo Phần C. |

---

## Dành cho người sửa code

```
index.html, style.css      giao diện
js/docfile.js              đọc file Shopee/TikTok, gộp nhiều file + chống trùng đơn
js/phanloai.js             quy tắc phân loại nhà, combo, tự học
js/xuatfile.js             xuất Excel 5 sheet (ExcelJS)
js/danhmuc.js              gọi Apps Script, cache danh mục, cài đặt (localStorage)
js/danhmuc-excel.js        xuất / nạp danh mục bằng Excel, file mẫu
js/app.js, khaibao.js, mandanhmuc.js, caidat.js, linhvat.js   các màn hình
lib/                       SheetJS 0.18.5, ExcelJS 4.4.0 (để sẵn, không cần mạng)
apps-script/Code.gs        Apps Script cho Google Sheets
test/                      kiểm thử tự động
```

Chạy kiểm thử (cần Node.js):
```
node test/kiemtra.js              # cần 2 file mẫu thật trong thư mục mau/ (không có trên repo)
node test/kiemtra-appscript.js    # kiểm thử Code.gs bằng môi trường giả lập
```
Thư mục `mau/` và mọi file `.xlsx` (trừ `templates/`) bị `.gitignore` chặn – **không bao giờ commit file đơn hàng thật**.
