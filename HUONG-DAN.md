# Hướng dẫn cài đặt & sử dụng "Tách đơn nhập nhà" 🐱📚

App giúp lọc file đơn hàng **Shopee** + **TikTok** thành danh sách nhập hàng cho 3 nhà:
**Hồng Ân (HA)** · **Khang Việt (KV)** · **Minh Long (ML)**, rồi xuất **đơn đặt hàng Excel riêng cho từng nhà**.

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
8. Quay lại tab Google Sheets: sẽ thấy 7 sheet **SKU_NHA**, **COMBO**, **COMBO_THANH_PHAN**, **LICH_SU**, **MA_CHUAN**, **LS_DAT_HANG**, **DON_DA_GHI**. ✅ (bản cập nhật sau này có thể tự thêm sheet mới khi cần)

> ⚠️ Không đổi tên, không đổi thứ tự cột của các sheet này. Muốn sửa danh mục thì nên sửa trong app (để có lịch sử).
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
   - **Shopee:** Đơn hàng → Chờ lấy hàng → **Xuất** (file có sheet `orders`) – hoặc xuất **tất cả trạng thái** (xem mục *Shopee: xuất file tất cả trạng thái* bên dưới).
   - **TikTok:** Đơn hàng → Chờ vận chuyển → **Xuất** (file có sheet `OrderSKUList`).
   - **Web:** xuất file **"Danh sách lấy hàng"** trên website (xem mục *Đơn web* bên dưới).
   - Có nhiều gian hàng thì xuất mỗi gian 1 file.
2. Mở app → **kéo thả** tất cả file vào ô có chú mèo (hoặc bấm **Chọn file**). Thả thêm file lúc nào cũng được.
   - Mỗi file hiện 1 chip: nguồn (**TikTok / Shopee / Web**), tên file, **số đơn mới**, số dòng.
     File Shopee có thêm *"n dòng cần lấy / m dòng bỏ qua (trạng thái khác)"*; file web ghi số dòng sách và thời gian xuất.
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
       Không cần nhập thành phần. Đơn đặt hàng của nhà đó sẽ có **1 dòng** cho combo: giá gốc = giá combo trên sàn, số lượng = số combo (cộng cả 2 sàn nếu đã gắn mã của cả 2 sàn).
       Combo **trộn nhà khác** (có MEGA, TN…) thì không chọn được "Xuất nguyên" – phải tách để chỉ lấy phần HA/KV/ML.
     - Khai báo xong, combo tự tách thành từng cuốn và cộng vào đơn của nhà – không cần thả file lại.
     - **App nhận ra combo khi:** tên/phân loại có chữ "combo", "bộ 3 cuốn", "(2 cuốn)", "Tập 1 + 2", **hoặc dạng "A+B"** (vd phân loại "VN+TG", "Toán + Văn", "Q1+Q2").
       Không tính "C++", "Lớp 1+" (không có vế sau). Dấu "+" chỉ nằm trong tên sản phẩm mà phân loại đã chọn 1 cuốn (vd tên "… Lớp 1+2+3", phân loại "Lớp 2") → vẫn là sách lẻ.
     - **🎁 nghi combo:** dòng dạng "A+B", hoặc 1 phân loại **không có barcode** mà giá **bằng tổng giá của ≥ 2 phân loại khác** cùng sản phẩm (lệch ≤ 2%) – vd "CỔ TÍCH VN+TG" 250.000 = Thế Giới 125.000 + Việt Nam 125.000.
       Dòng này vào tab Combo kèm lý do. Bấm **🧩 Khai báo thành phần** (form đã gợi ý sẵn các phân loại khác cùng sản phẩm có barcode) hoặc **🙅 Không phải combo** → trả về sách lẻ, app ghi nhớ không hỏi lại.
   - **🎁 Đây là combo** (nút nhỏ dưới tên ở bảng Hồng Ân / Khang Việt / Minh Long và tab Chưa rõ nhà): dòng bị nhận là sách lẻ nhưng thật ra là combo → bấm để khai báo combo. Lưu xong kết quả tự tính lại.
   - **💾 Lưu vào danh mục** (nút nhỏ dưới tên): sách đang nhận diện tại chỗ (vd từ mã nhà trong tên, chưa có trong danh mục, thường là listing không có barcode) → lưu lại để sửa tên / đổi nhà ở màn Danh mục.
   - **🙈 Đã bỏ qua:** lịch, tranh, trà… và sách nhà khác. Nếu bị bỏ nhầm thì chọn lại nhà ở cột cuối.
5. **Tải đơn đặt hàng gửi nhà** – mỗi nhà 1 file riêng:
   - Mỗi thẻ **Hồng Ân / Khang Việt / Minh Long** có nút **⬇️ Tải file** (nhà 0 cuốn thì nút mờ).
   - Nút lớn **⬇️ Tải cả 3 nhà** tải lần lượt file của các nhà có hàng, bỏ qua nhà 0 cuốn.
     (Lần đầu Chrome/Edge có thể hỏi *"Cho phép tải nhiều tệp"* → chọn **Cho phép**.)
   - Tên file: `Don-dat-hang_Hong-An_dd-mm-yyyy.xlsx`, `Don-dat-hang_Khang-Viet_…`, `Don-dat-hang_Minh-Long_…`.
   - Sheet Combo và Chưa rõ nhà **không còn** trong file – hãy xử lý xong trên app trước khi tải.

   **Nhắc trước khi tải** (chỉ hiện khi có vấn đề; ổn hết thì tải luôn):
   - Còn **combo chưa khai báo / sách chưa rõ nhà** → các dòng này sẽ KHÔNG có trong file.
   - Trong nhà đang tải có **cùng SKU nhưng giá khác nhau** → app liệt kê để bạn kiểm tra.
   - Tải 1 nhà thì chỉ nhắc vấn đề của nhà đó (kể cả combo đoán được thuộc nhà đó). Tải cả 3 thì nhắc tất cả.
   - Bấm **🔍 Xem lại** để app mở đúng tab cần xử lý, hoặc **⬇️ Vẫn tải**.

   **Nội dung file gửi nhà** (1 sheet, tên sheet = tên nhà) – chỉ **4 cột**:
   - **STT | Tên sách | Giá bìa | Số lượng**. Dòng 1 là tiêu đề cột, dữ liệu từ dòng 2, sắp xếp theo tên A→Z.
   - Không có SKU/barcode, thành tiền, dòng tiêu đề đơn, thông tin shop hay dòng tổng.
   - **Chỉ gộp 1 dòng khi cùng barcode** (kể cả mã đã quy về: mã phụ, tái bản, mã web) **và cùng giá**; SKU trống / dạng chữ thì gộp khi cùng tên sàn đã làm gọn + cùng phân loại + cùng giá.
     **Hai barcode khác nhau luôn là 2 dòng**, dù tên giống nhau. Cùng barcode mà khác giá → 2 dòng (tô vàng trên app để kiểm tra).
   - Tên sách lấy theo **tên đã khai báo** (xem mục *Tên sách khai báo* bên dưới).
   - In sẵn khổ **A4 dọc**, vừa 1 trang chiều ngang, sang trang tự lặp lại dòng tiêu đề cột.
   - Đã cộng cả Shopee, TikTok, web, phần tách từ combo và combo "xuất nguyên".

### Tên sách khai báo ✏️
Một listing trên sàn có thể gom nhiều cuốn (vd "Vở Bài Tập Thực Hành Mĩ Thuật **Các Lớp**", phân loại Lớp 1 / Lớp 2 / Lớp 3 – mỗi lớp 1 barcode), nên **tên sàn không đủ**.
Tên in ra file gửi nhà (và hiện trên app) lấy theo thứ tự:
1. **Tên đã khai báo** trong danh mục (cột **Tên sách**) cho barcode đó.
2. **Tên trong sổ mã chuẩn web** cho barcode đó (nhãn *🌐 tên web*).
3. Với cuốn tách từ combo: **tên đã khai báo của thành phần combo**.
4. Chưa có tên khai báo → **tên tạm** = tên sàn đã làm gọn + " – " + phân loại, vd *"Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp – LỚP 3"*, kèm nhãn **"chưa có tên khai báo"**.
   Phân loại vô nghĩa (trống, Not Specified, Default, Mặc định, Lẻ…) hoặc đã có sẵn trong tên thì không ghép – danh sách này sửa ở **Cài đặt**.

Cách khai báo:
- **Ngay trên màn Tách đơn:** bấm **✏️** cạnh tên sách → sửa → **💾 Lưu tên**. Lưu vào danh mục, lần sau luôn dùng tên này.
- **Danh mục → SKU → nhà:** cột **Tên sách** sửa được từng dòng (gõ xong bấm Tab / bấm ra ngoài là lưu). Sách chưa khai báo hiện sẵn **gợi ý** (tên web, không có thì tên tạm) chữ nghiêng.
  Tick **"Chưa có tên khai báo"** để lọc ra các sách cần rà, sửa các ô cần sửa rồi bấm **✔ Dùng gợi ý cho … sách đang hiện** để lưu hàng loạt.
- **Nạp Excel:** sheet SKU_NHA có cột **ten_sach** (hoặc "Tên sách"). Có cột này thì ô trống = bỏ khai báo; file không có cột này thì giữ nguyên tên cũ.
- **Tự học / đơn web không bao giờ ghi đè** tên bạn đã khai báo. Đổi nhà cũng không mất tên.

**Tên sách được làm gọn:** bỏ phần loại sách ở đầu ("Sách -", "Sách Tham Khảo -"…) và phần mã nhà, tên shop, tác giả ở cuối ("- HA - Newshop", "(HA)", "- KV - Tác Giả …"). Ví dụ
"Sách Tham Khảo - Hướng Dẫn Giải Bài Tập Toán Lớp 3 (Dùng Kèm SGK Kết Nối) - HA - Newshop" → "Hướng Dẫn Giải Bài Tập Toán Lớp 3 (Dùng Kèm SGK Kết Nối)".
Trên màn hình app cũng hiện tên gọn; **rê chuột vào tên** để xem tên gốc. Dữ liệu gốc và danh mục không bị đổi.

Ý nghĩa màu **trên màn hình app** (file gửi nhà KHÔNG tô các màu này):
- 🟧 **Ô SKU màu cam:** SKU trống hoặc không phải mã vạch – app nhận diện bằng tên + phân loại.
- 🟨 **Cả dòng màu vàng:** cùng SKU nhưng giá gốc khác nhau (để 2 dòng riêng cho bạn kiểm tra).
- 🟦 **Ô SKU màu xanh dương nhạt:** có đơn còn dùng **mã cũ** của sách đã tái bản – app đã tính vào mã mới. Nên sửa SKU của listing đó trên sàn (xem mục *"Mã cũ trên sàn – nên sửa listing"* trên màn hình).

### Đơn web 🌐 (file "Danh sách lấy hàng" của website)
- Thả file **Danh_Sach_Lay_Hang…xlsx** vào cùng chỗ với file Shopee/TikTok. App tự nhận ra, chip hiện nhãn **Web**.
- App tự tìm dòng tiêu đề (STT | Barcode | Tên sản phẩm | SL | Giá bìa | … | Nhà cung cấp | …), đọc các dòng có STT là số, dừng ở dòng trống / dòng "Nhân viên lấy hàng".
- File web **đã cộng gộp theo sách** (không có mã đơn): mỗi dòng = 1 cuốn, **SL** = số lượng cần. Cột **"Trong kho" được bỏ qua** – luôn đặt đủ SL.
- **Nhà theo cột "Nhà cung cấp"** (ưu tiên hơn mọi quy tắc khác):
  - chứa "Hồng Ân" → **HA**, "Khang Việt" → **KV**, "Minh Long" → **ML** (không phân biệt hoa thường, dấu cách thừa);
  - nhà cung cấp khác (MegaBook, Việt Thư Books, Newshop.vn…) → **Đã bỏ qua** (nhà khác);
  - trống → xử lý như bình thường (danh mục, mã trong tên); không ra thì vào **Chưa rõ nhà**.
- **Tự học từ web:** dòng có barcode + nhà cung cấp HA/KV/ML được ghi vào danh mục với nguồn **🌐 web**. Lần sau gặp barcode đó ở Shopee/TikTok, dù tên thiếu mã nhà, app vẫn nhận đúng.
  Thứ tự ưu tiên: **gán tay > web > tự học** (web không bao giờ đè gán tay).
- **Chống trùng:** thả lại **đúng file web đã thả** (cùng "Thời gian xuất" và cùng nội dung) → app báo *"File web này đã được thả"* và bỏ qua. Hai file web khác nhau thì cộng dồn.

### Sổ mã chuẩn 🌐 (barcode web làm gốc)
Barcode trên sàn đôi khi sai (quên sửa sau tái bản, gõ nhầm, listing cũ). **Barcode trong file đơn web là chuẩn.**
- Mỗi lần thả file web, các dòng có barcode được ghi / cập nhật vào **sổ mã chuẩn** (sheet `MA_CHUAN`): barcode, tên đã làm gọn, giá bìa, nhà cung cấp, ngày thấy gần nhất. Gom chung lần ghi tự học.
- Nạp nhiều file web cũ một lúc: **Danh mục → 🌐 Nạp sổ mã chuẩn từ file web cũ** (chọn được nhiều file; bản cũ hơn không đè bản mới hơn).

**App tự so sách lẻ trên Shopee/TikTok với sổ mã chuẩn** (chỉ xét listing có barcode KHÔNG có trong sổ, hoặc SKU trống / dạng chữ; so **tên sàn + phân loại** đã làm gọn, không dấu, chữ thường –
vd "Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp – Lớp 3" chỉ khớp được cuốn web Lớp 3; 2 tên có số khác nhau (Lớp 1 / Lớp 3, Tập 1 / Tập 2) không bao giờ bị coi là cùng cuốn):
- **Khớp chắc** – tên + phân loại trùng hẳn **và** cùng giá bìa → **tự quy về barcode web**: cộng chung 1 dòng với cuốn đó, dùng tên của bản web, ghi chú *"🌐 đã quy về mã web"*. App lưu listing đó thành **mã phụ → mã web** (nguồn *web tự khớp*) để lần sau tự nhận.
- **Khớp vừa** – tên trùng hẳn nhưng khác giá, **hoặc** tên giống ≥ 90% + cùng nhà + giá chênh ≤ 15% → **không tự gộp**, hiện khung **"🔁 Có thể cùng 1 cuốn"**:
  - **✅ Đúng, cùng cuốn** → lưu mã phụ (nguồn *gán tay*), lần sau tự tính vào mã web.
  - **Không phải** → ghi nhớ, không hỏi lại listing đó nữa.
- Thứ tự ưu tiên: **gán tay > mã phụ > web > tự học**. App **không bao giờ** tự đè dữ liệu bạn đã gán tay.

### Listing cần sửa barcode 🏷️
Mục **"🏷️ Listing cần sửa barcode"** (dưới bảng kết quả) liệt kê các listing trên sàn nên sửa SKU tận gốc:
**Sàn | Tên sản phẩm trên sàn | Phân loại | Barcode trên sàn | Barcode web (chuẩn) | Lý do**. Lý do gồm:
*khớp chắc* (app tự quy về mã web), *tôi xác nhận* (bạn đã bấm "Đúng, cùng cuốn"), *tái bản* (mã cũ sau khi thay mã), *mã sai số kiểm tra* (barcode 13 số sai chữ số kiểm tra EAN-13).
Bấm **📤 Xuất Excel** để gửi nhân viên sửa trên sàn.

### Shopee: xuất file tất cả trạng thái 🛍️
- Có thể xuất file Shopee **tất cả trạng thái** (vd `Order.all.….xlsx`) để lấy cả đơn thiếu từ hôm trước còn treo.
- App chỉ lấy dòng có **"Trạng Thái Đơn Hàng"** đúng là **"Chờ giao hàng"** hoặc **"Chờ xác nhận"**; các trạng thái khác (Đang giao, Đã giao, Đã hủy, Người mua xác nhận…) đều bỏ.
  Danh sách trạng thái sửa được ở **Cài đặt → Trạng thái đơn Shopee cần lấy** (mỗi dòng 1 trạng thái).
- Chip file hiện *"n dòng cần lấy / m dòng bỏ qua (trạng thái khác)"*.
- File "Chờ lấy hàng" kiểu cũ vẫn dùng bình thường. Thả cả file cũ lẫn file tất cả trạng thái cùng ngày **không bị cộng 2 lần** (chống trùng theo mã đơn).

### Mèo tự học 🐾
Mỗi lần tách đơn, sách lẻ có mã vạch và có đúng 1 mã nhà trong tên (vd "… - HA - Newshop") sẽ được tự ghi vào danh mục (nguồn **tự học**).
Lần sau nếu tên sách thiếu mã nhà, app vẫn nhận ra. Những gì bạn **gán tay** luôn được ưu tiên – tự học không bao giờ ghi đè.

## Khi sách tái bản / tăng giá 📈🔁

### Sách tăng giá
- Mỗi lần thả file, với **sách lẻ có mã vạch đã có trong danh mục**, app ghi lại **giá gần nhất** (giá gốc trong file; nhiều giá trong ngày thì lấy giá cao nhất).
  Chỉ ghi khi giá đổi, gom chung vào lần ghi tự học, và ghi vào **Lịch sử** ("Cập nhật giá: 25.000 → 28.000"). Không bao giờ đổi nhà / nguồn bạn đã gán tay.
- Khi **tách combo**, giá mỗi cuốn lấy theo thứ tự: **giá sách lẻ đó trong file hôm nay** → **giá gần nhất trong danh mục** → giá đã khai báo trong combo.
- Nếu giá khai báo trong combo khác giá mới nhất, app hiện nhãn **"💸 Giá đã đổi: 25.000 → 28.000"** ở tab Combo (màn Tách đơn) và ở Danh mục > Combo.
  Bấm **Cập nhật giá** (từng combo) hoặc **💸 Cập nhật giá tất cả combo** để sửa giá khai báo (có ghi Lịch sử).
- Danh mục > SKU → nhà có cột **Giá gần nhất (ngày)**.

### Sách tái bản (đổi mã vạch)
**App tự phát hiện:** khi file có một sách lẻ mã vạch **mới** (chưa có trong danh mục) mà **tên trùng** một sách đã có, đầu trang hiện khung:
> 🔁 Có thể là bản tái bản: *Tập Viết Tiếng Nhật Katakana* — mã cũ 8935092825731 (28.000đ) → mã mới 8935092999999 (30.000đ)
- **✅ Đúng, thay mã** → app thay mã (xem bên dưới).
- **Không phải** → app ghi nhớ cặp mã này và không hỏi lại nữa.

**Thay mã bằng tay:** Danh mục > SKU → nhà → dòng sách cũ → **🔁 Thay mã tái bản** → nhập mã vạch mới (bắt buộc), giá mới và tên mới (không bắt buộc).

Khi thay mã cũ **X** → mã mới **Y**, app làm một lần:
1. Tạo dòng **Y** (cùng nhà với X, nguồn "gán tay", giá mới). Dòng **X** được giữ lại làm **mã phụ** trỏ về Y.
2. Mọi combo có cuốn X → đổi thành Y. Khóa nhận diện combo theo X được giữ và thêm khóa tương ứng theo Y.
3. Đơn **còn dùng mã cũ X** (listing trên sàn chưa sửa) vẫn được tính như Y: xuất SKU Y, cộng chung với Y, ô SKU tô **xanh dương nhạt**, và có danh sách **"🏷️ Mã cũ trên sàn – nên sửa listing"** (sàn, tên sản phẩm, mã cũ → mã mới).
4. Tái bản nhiều lần (X → Y → Z): thay tiếp trên mã mới nhất (Y → Z); đơn dùng X hay Y đều ra Z. App chặn trường hợp vòng lặp.

**Hoàn tác:** Danh mục > 🕘 Lịch sử → dòng **"🔁 Thay mã tái bản"** → **↩️ Hoàn tác** → danh mục SKU và combo liên quan trở về đúng như trước khi thay (việc hoàn tác cũng được ghi Lịch sử; mỗi lần thay mã chỉ hoàn tác được 1 lần).

## Thống kê & dự báo 📊🔮

### Lịch sử đặt hàng (tự ghi)
- Mỗi lần bấm **⬇️ Tải file** (1 nhà hoặc cả 3 nhà), app ghi số đã đặt **hôm nay** vào sheet **LS_DAT_HANG**: ngày, nhà, barcode (đã quy về mã chuẩn), tên sách, giá bìa, số lượng, số lượng **tách theo Shopee / TikTok / Web**, và **số lượng đơn treo từ ngày trước** (đơn có ngày đặt trước hôm nay).
- **Không lưu thông tin khách** (không tên, SĐT, địa chỉ…). Sheet **DON_DA_GHI** chỉ giữ mã đơn + ngày để không nạp trùng.
- Tải lại trong cùng ngày → app **ghi đè** số của ngày đó cho nhà vừa tải, không cộng dồn. Số dự phòng đã thêm **không** tính vào lịch sử.
- Mọi thứ gom thành **1 lần ghi**. Khi sheet vượt khoảng 30.000 dòng app nhắc; vượt 40.000 dòng app tự gom các ngày cũ hơn 6 tháng thành 1 dòng/tháng.

### Nạp lịch sử từ file đơn cũ
Muốn có thống kê ngay (khỏi chờ vài tuần): tab **📊 Thống kê → 📥 Nạp lịch sử từ file đơn cũ** → chọn **nhiều file** cùng lúc: file Order_all Shopee (tất cả trạng thái), file TikTok, "Danh sách lấy hàng" web cũ.
- Mỗi đơn tính vào **ngày đặt** của đơn (web: ngày xuất file).
- **Đơn đã hủy không tính.** Đơn trùng mã (giữa các file, hoặc đã có trong lịch sử) **bỏ qua** – nạp lại cùng file cũng không bị cộng 2 lần.
- Combo chưa khai báo / sách chưa rõ nhà không được tính (app báo số cuốn bị bỏ trước khi nạp).

### Tab 📊 Thống kê
- **Bộ lọc:** nhà (cả 3 / HA / KV / ML), thời gian (7 / 30 / 90 ngày / tùy chọn từ–đến), nguồn (tất cả / Shopee / TikTok / Web).
- **Top sách**, **biểu đồ cột** tổng theo tuần của từng nhà, **biểu đồ đường** số cuốn theo ngày (rê chuột vào cột/điểm để xem số).
- **📈 Đang tăng:** 7 ngày gần nhất so với 7 ngày trước, tăng ≥ 50% và thêm ≥ 5 cuốn.
- **💤 Lâu không có đơn:** từng có đơn nhưng ≥ 30 ngày nay không thấy.
- **⚠️ Hay bị thiếu:** có đơn treo từ ngày trước ≥ 3 lần trong 30 ngày (dấu hiệu nhà hay giao thiếu / hết hàng).
- **📤 Xuất Excel các bảng:** 1 file nhiều sheet (Top sách, Theo tuần, Theo ngày, Đang tăng, Lâu không có đơn, Hay bị thiếu).
- Số cuốn "tất cả nguồn" = số đặt trừ phần đơn treo từ ngày trước (vì phần đó đã tính ở ngày trước), để không đếm 2 lần.

### Gợi ý đặt dự phòng 🔮
- Ở màn Tách đơn, bảng của từng nhà có thêm cột **Gợi ý dự phòng**.
- Cách tính: trung bình bán mỗi ngày trong **28 ngày gần nhất** (tính đến hôm qua), ngày càng gần càng nặng (hôm qua × 28, hôm kia × 27, …). Gợi ý = **làm tròn lên (trung bình × số ngày dự phòng)**.
- Chỉ gợi ý cho sách **bán đều**: có đơn ít nhất **10 trong 28 ngày**. Lịch sử chưa đủ **14 ngày** → hiện *"Chưa đủ dữ liệu để dự báo"*.
- **Chỉ là gợi ý – mặc định không cộng vào file.** Bấm **➕ Thêm vào đơn** (từng cuốn) hoặc **➕ Thêm tất cả** (cả nhà) thì số đó mới được cộng vào file tải về; bấm **Bỏ** / **↩️ Bỏ hết dự phòng** để gỡ.
- Số ngày dự phòng chỉnh ở **Cài đặt** (mặc định 2). Để 0 hoặc bỏ tick → ẩn cột.

## Màn Danh mục

- **SKU → nhà:** tìm kiếm (gõ không dấu cũng được), cột **Tên sách** (sửa được, lọc "Chưa có tên khai báo"), đổi nhà, xóa (có hỏi lại), cột **Giá gần nhất (ngày)**, nút **🔁 Thay mã tái bản**; mã đã bị thay hiện nhãn *"mã phụ → mã mới"*.
- **Tìm kiếm** (cả SKU → nhà, Combo, Lịch sử): theo barcode, tên sàn, phân loại, tên đã khai báo, khóa nhận diện; không phân biệt dấu, hoa thường, ngoặc, dấu "+" – vd gõ `co tich vn tg` ra "CỔ TÍCH VN+TG (ML)".
  Không thấy ở SKU → nhà mà có combo khớp thì app gợi ý chuyển sang tab Combo. Mục không có barcode (khóa tên + phân loại) cũng hiện và tìm được như thường.
- **Combo:** xem thành phần, cột **Cách xuất** (✂️ Tách / 📦 Nguyên combo – đổi qua lại ngay tại đây), **✏️ Sửa**, xóa (hiện rõ tên combo và các thành phần trước khi xóa).
  - Combo có SKU là **mã vạch** (vd dòng Shopee "Hiragana (HA)" phân loại COMBO.HA) được nhận diện bằng mã vạch **kèm phân loại** (`sku:8935092825724|combo.ha`), để không nhầm với cuốn lẻ cùng mã vạch. Combo khai báo trước đây bằng mã vạch trơn sẽ **tự đổi sang khóa mới** lần đầu bạn thả file có combo đó (có ghi Lịch sử).
- **🕘 Lịch sử:** 100 thay đổi gần nhất (gán nhà, tự học, cập nhật giá, lưu/xóa combo, thay mã tái bản…), có dữ liệu trước và sau, nút **↩️ Hoàn tác** cho thay mã tái bản. Bản đầy đủ ở sheet **LICH_SU**.
- **📤 Xuất danh mục ra Excel:** sao lưu thủ công về máy.
- **📥 Nạp từ Excel:** nạp hàng loạt. Bấm **📄 Tải file mẫu** (hoặc dùng [`templates/mau-nap-danh-muc.xlsx`](templates/mau-nap-danh-muc.xlsx)), đọc sheet `HUONG_DAN` trong file, điền rồi nạp. File xuất ở trên cũng nạp lại được.

## Màn Cài đặt

- **URL Apps Script** (xem Phần D, F).
- **Mã nhà khác:** các mã sẽ bị bỏ qua (mặc định `MEGA, VT, HH, NS, QB, TN, HT`). Có nhà mới thì thêm vào, cách nhau dấu phẩy.
- **Kiểm tra kết nối.**
- **Trạng thái đơn Shopee cần lấy:** mỗi dòng 1 trạng thái (mặc định *Chờ giao hàng*, *Chờ xác nhận*). Ghi đúng như cột "Trạng Thái Đơn Hàng" trong file Shopee.
- **Mã nhà khác:** có nhà mới (vd sách ghi "(STK)") thì tự thêm vào ô này – app không tự thêm.
- **Phân loại vô nghĩa:** các phân loại không ghép vào tên tạm (mặc định Not Specified, Default, Mặc định, Lẻ, 1 cuốn).
- **Gợi ý đặt dự phòng:** bật/tắt cột gợi ý và số ngày dự phòng (mặc định 2, để 0 = tắt).

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
js/docfile.js              đọc file Shopee/TikTok/web, lọc trạng thái Shopee, gộp nhiều file + chống trùng đơn
js/phanloai.js             quy tắc phân loại nhà, combo, tự học
js/xuatfile.js             xuất file gửi nhà (4 cột, mỗi nhà 1 file) + kiểm tra trước khi tải (ExcelJS)
js/danhmuc.js              gọi Apps Script, cache danh mục, cài đặt (localStorage)
js/danhmuc-excel.js        xuất / nạp danh mục bằng Excel, file mẫu
js/thongke.js              lịch sử đặt hàng, thống kê, dự báo dự phòng (phần tính toán)
js/app.js, khaibao.js, mandanhmuc.js, manthongke.js, caidat.js, linhvat.js   các màn hình
lib/                       SheetJS 0.18.5, ExcelJS 4.4.0 (để sẵn, không cần mạng)
apps-script/Code.gs        Apps Script cho Google Sheets
test/                      kiểm thử tự động
```

Chạy kiểm thử (cần Node.js):
```
node test/kiemtra.js              # cần 2 file mẫu thật trong thư mục mau/ (không có trên repo)
node test/kiemtra-appscript.js    # kiểm thử Code.gs bằng môi trường giả lập
node test/kiemtra-taiban.js        # giá gần nhất + thay mã tái bản (Code.gs giả lập + phân loại, cần file mẫu)
node test/kiemtra-web.js           # đơn web + Shopee tất cả trạng thái (cần mau/web.xlsx, mau/shopee-all.xlsx)
node test/kiemtra-machuan.js       # sổ mã chuẩn, khớp sách lẻ trùng, listing cần sửa barcode
node test/kiemtra-combo.js         # combo dạng "A+B", nghi combo theo giá, "Không phải combo", "Đây là combo"
node test/kiemtra-tensach.js       # tên sách khai báo, không gộp theo tên, khớp mã web theo tên + phân loại
node test/kiemtra-thongke.js       # lịch sử đặt hàng (ghi đè, nạp file cũ), thống kê, dự báo dự phòng
```
Thư mục `mau/` và mọi file `.xlsx` (trừ `templates/`) bị `.gitignore` chặn – **không bao giờ commit file đơn hàng thật**.
