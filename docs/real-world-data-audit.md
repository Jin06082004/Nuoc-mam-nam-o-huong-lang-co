# BÁO CÁO KIỂM KÊ DỮ LIỆU THỰC TẾ & KẾ HOẠCH NẠP NỘI DUNG
## Dự án: Nước Mắm Nam Ô — Hương Làng Cổ
**Mã tài liệu:** `docs/real-world-data-audit.md`  
**Giai đoạn:** Phase 5.17 — Real-World Data Discovery & Content Ingestion  
**Ngày thực hiện:** 24/10/2026  
**Nguyên tắc cốt lõi:** Xác thực 100% dựa trên nguồn chính thức và cơ quan có thẩm quyền. Tuyệt đối **KHÔNG** bịa đặt, suy diễn, hoặc điền giá trị phỏng đoán vào dữ liệu sản xuất.

---

## MỤC LỤC
1. [Phần 1: Ánh xạ cấu trúc Database (Source → Field → Website)](#phan-1-anh-xa-cau-truc-database)
2. [Phần 2: Bản đồ nguồn dữ liệu (Source Map & Trust Hierarchy)](#phan-2-ban-do-nguon-du-lieu)
3. [Phần 3: Hồ sơ thương hiệu chính thức (Brand Profile)](#phan-3-ho-so-thuong-hieu-chinh-thuc)
4. [Phần 4: Danh mục sản phẩm xác thực (Product Catalog & Variants)](#phan-4-danh-muc-san-pham-xac-thuc)
5. [Phần 5: Danh mục hình ảnh & Bản quyền (Image Catalog)](#phan-5-danh-muc-hinh-anh)
6. [Phần 6: Danh mục bài viết & Di sản văn hóa (Blog Content Map)](#phan-6-danh-muc-bai-viet)
7. [Phần 7: Báo cáo xung đột dữ liệu (Conflict Report)](#phan-7-bao-cao-xung-dot-du-lieu)
8. [Phần 8: Dữ liệu chưa xác định cần chủ cơ sở xác nhận (Unknown Data)](#phan-8-du-lieu-can-xac-nhan)
9. [Phần 9: Kế hoạch nạp dữ liệu an toàn (Database Import Plan)](#phan-9-ke-hoach-nap-du-lieu-an-toan)

---

<a name="phan-1-anh-xa-cau-truc-database"></a>
## PHẦN 1: ÁNH XẠ CẤU TRÚC DATABASE
*(Kiểm tra trực tiếp từ `database/schema.sql` và migration `database/migrations/001_store_settings.sql`)*

| Thông tin thực tế | Trường dữ liệu (Database Field) | Kiểu dữ liệu & Ràng buộc | Vị trí hiển thị trên Website |
| :--- | :--- | :--- | :--- |
| **Tên thương hiệu / Cửa hàng** | `store_settings.store_name` | `VARCHAR(150) NOT NULL` | Header logo text, Footer copyright, Thẻ title SEO, Hóa đơn đơn hàng |
| **Mô tả ngắn thương hiệu** | `store_settings.store_description` | `VARCHAR(500) NULL` | Thẻ meta description SEO, Đoạn giới thiệu chân trang Footer |
| **Logo chính thức** | `store_settings.logo_url` | `VARCHAR(2048) NULL` | Header brand logo (`/images/logo.jpg`), Footer brand logo |
| **Địa chỉ trụ sở / Xưởng** | `store_settings.store_address` | `VARCHAR(500) NULL` | Khối thông tin liên hệ ở Footer, Trang Liên hệ (`/contact`) |
| **Hotline / Điện thoại liên hệ** | `store_settings.contact_phone` | `VARCHAR(32) NULL` | Header top bar hotline, Footer, Nút gọi trực tiếp trên Mobile |
| **Email liên hệ** | `store_settings.contact_email` | `VARCHAR(254) NULL` | Footer, Trang liên hệ (`/contact`), Email thông báo đơn hàng |
| **Phí giao hàng mặc định** | `store_settings.shipping_fee` | `DECIMAL(12,2) NULL` | Bảng tính tổng tiền giỏ hàng (`/cart`) và thanh toán (`/checkout`) |
| **Bật miễn phí vận chuyển** | `store_settings.free_shipping_enabled` | `BOOLEAN NOT NULL DEFAULT 0`| Thanh thông báo tiến độ freeship tại Cart Drawer / Trang Cart |
| **Ngưỡng đơn freeship** | `store_settings.free_shipping_minimum` | `DECIMAL(12,2) NULL` | Hiển thị: "Miễn phí vận chuyển cho đơn hàng từ X đ" |
| **Phương thức thanh toán COD** | `store_settings.cod_enabled` | `BOOLEAN NOT NULL DEFAULT 1`| Lựa chọn "Thanh toán khi nhận hàng (COD)" tại trang Checkout |
| **Thanh toán chuyển khoản** | `store_settings.bank_transfer_enabled`| `BOOLEAN NOT NULL DEFAULT 0`| Lựa chọn "Chuyển khoản ngân hàng" tại trang Checkout |
| **Thông tin ngân hàng** | `store_settings.bank_name`<br>`bank_account_number`<br>`bank_account_holder`<br>`bank_branch` | `VARCHAR(100)`<br>`VARCHAR(50)`<br>`VARCHAR(150)`<br>`VARCHAR(150)` | Hộp hướng dẫn chuyển khoản (kèm mã đơn hàng & QR) sau khi đặt hàng |
| **Mạng xã hội Facebook** | `store_settings.facebook_url` | `VARCHAR(2048) NULL` | Icon mạng xã hội tại Header và Footer |
| **Mạng xã hội TikTok** | `store_settings.tiktok_url` | `VARCHAR(2048) NULL` | Icon TikTok tại Header và Footer |
| **Mạng xã hội YouTube** | `store_settings.youtube_url` | `VARCHAR(2048) NULL` | Icon YouTube tại Header và Footer |
| **Kênh MXH linh hoạt** | `social_links` (`platform`, `name`, `url`, `icon`, `is_active`, `sort_order`) | `platform IN ('FACEBOOK', 'TIKTOK', 'YOUTUBE')` | Danh sách link MXH linh hoạt ở Footer |
| **Danh mục sản phẩm** | `categories` (`name`, `slug`, `description`, `image_url`, `status`, `sort_order`) | `slug UK`, `status IN ('ACTIVE','INACTIVE','ARCHIVED')` | Menu điều hướng Header, Bộ lọc sản phẩm, Grid danh mục trang chủ |
| **Sản phẩm chính** | `products` (`category_id`, `name`, `slug`, `short_description`, `description`, `status`) | `slug UK`, `status IN ('DRAFT','ACTIVE','ARCHIVED')` | Card sản phẩm trên catalog (`/products`), Trang chi tiết (`/products/[slug]`) |
| **Biến thể & Giá bán** | `product_variants` (`product_id`, `sku`, `name`, `volume`, `unit`, `price`, `compare_price`, `status`) | `sku UK`, `price >= 0`, `status IN ('ACTIVE','INACTIVE','ARCHIVED')` | Lựa chọn quy cách (dung tích/chai/hộp), Giá niêm yết, Giá so sánh gạch bỏ |
| **Hình ảnh sản phẩm** | `product_images` (`product_id`, `image_url`, `alt_text`, `is_primary`, `sort_order`) | `is_primary (tối đa 1 ảnh/sp)` | Ảnh đại diện trên thẻ sản phẩm, Gallery ảnh phóng to ở trang chi tiết |
| **Tồn kho khả dụng** | `inventory` (`variant_id`, `quantity`, `reserved_quantity`) | `reserved_quantity <= quantity` | Kiểm tra tồn kho trước khi thêm vào giỏ và đặt hàng |
| **Danh mục bài viết** | `blog_categories` (`name`, `slug`, `description`, `status`, `sort_order`) | `slug UK`, `status IN ('ACTIVE','INACTIVE','ARCHIVED')` | Tab phân loại bài viết tại trang Blog (`/blog`) |
| **Bài viết tin tức/di sản** | `blog_posts` (`category_id`, `title`, `slug`, `excerpt`, `content`, `thumbnail_url`, `status`, `published_at`) | `slug UK`, `status IN ('DRAFT','PUBLISHED','ARCHIVED')` | Danh sách bài viết (`/blog`), Chi tiết bài đọc (`/blog/[slug]`) |
| **Banner trang chủ** | `banners` (`title`, `image_url`, `link_url`, `sort_order`, `is_active`, `start_at`, `end_at`) | `date_range CHECK`, `is_active` | Slider / Hero banner quảng bá thương hiệu tại trang chủ |

---

<a name="phan-2-ban-do-nguon-du-lieu"></a>
## PHẦN 2: BẢN ĐỒ NGUỒN DỮ LIỆU (SOURCE MAP & TRUST HIERARCHY)

Tất cả thông tin được thu thập đều được xếp hạng phân cấp tin cậy nghiêm ngặt:

```
[LEVEL 1: OFFICIAL]
  ├── Tài sản do Chủ cơ sở cung cấp trực tiếp (logo.jpg, hero-banner.jpg)
  ├── Fanpage Facebook chính thức: facebook.com/huonglangco.vn (Khớp link do chủ cơ sở cung cấp)
  └── Đăng ký kinh doanh Công ty TNHH Mắm Hồng Hương (Đại diện: Bùi Thanh Phú)
       │
[LEVEL 2: AUTHORITATIVE EXTERNAL SOURCES]
  ├── Cổng thông tin Du lịch Đà Nẵng (Trung tâm Xúc tiến Du lịch TP Đà Nẵng — danangfantasticity.com)
  ├── Báo Nhân Dân, Báo Tuổi Trẻ, Báo Đà Nẵng, Báo Dân Việt, Báo VietnamPlus (TTXVN)
  ├── Cục Du lịch Quốc gia Việt Nam (vietnamtourism.gov.vn)
  ├── Quyết định công nhận OCOP 4 sao của UBND Thành phố Đà Nẵng
  └── Quyết định số 2974/QĐ-BVHTTDL của Bộ VHTTDL công nhận Làng nghề Nam Ô là Di sản phi vật thể quốc gia
       │
[LEVEL 3: SECONDARY SOURCES]
  ├── Sàn Đặc sản Ngon Đà Nẵng (dacsanngondanang.com), ViGift (vigift.vn), Nongpro (nongpro.com)
  └── *(Chỉ dùng để đối chiếu quy cách đóng gói thương mại; KHÔNG tự ý lấy giá lẻ đại lý làm giá gốc)*
       │
[LEVEL 4: UNTRUSTED / REJECTED]
  └── Các trang scraper tự động, bài đăng không rõ nguồn gốc, thông tin giá chênh lệch không kiểm chứng.
```

### Danh mục nguồn phát hiện:
1. **Nguồn chính thức (Level 1):**
   - **Tài sản thương hiệu trực tiếp:** `logo.jpg` và `hero-banner.jpg` (Chủ sở hữu cung cấp lưu tại `client/public/images/`).
   - **Facebook Fanpage:** `https://www.facebook.com/huonglangco.vn` (Tên hiển thị: *Nước Mắm Nam Ô - Hương Làng Cổ*).  
     *Xác minh:* Đường link chia sẻ do người dùng cung cấp (`https://www.facebook.com/share/18aqjfUGiy/?mibextid=wwXIfr`) chính là link share mobile dẫn trực tiếp đến Fanpage chính thức này.
   - **Website đăng ký của cơ sở:** `huonglangco.vn` *(tên miền chính thức của thương hiệu)*.
2. **Cơ quan nhà nước & Báo chí uy tín (Level 2):**
   - **Cơ sở dữ liệu Đăng ký Kinh doanh Quốc gia:** Mã số thuế `0401801078` — CÔNG TY TNHH MẮM HỒNG HƯƠNG (Đại diện pháp luật: Bùi Thanh Phú).
   - **Cổng thông tin Du lịch Đà Nẵng (Danang Fantasticity - Sở Du lịch TP. Đà Nẵng):** Xác nhận thông tin cơ sở Hương Làng Cổ, hotline `0935 998 908`, địa chỉ Nam Ô 2, sản phẩm OCOP.
   - **Bộ Văn hóa, Thể thao và Du lịch:** Quyết định số 2974/QĐ-BVHTTDL ngày 27/8/2019 công nhận *Nghề làm nước mắm Nam Ô* là Di sản văn hóa phi vật thể Quốc gia.
   - **Báo Nhân Dân, Báo Đà Nẵng, Báo Tuổi Trẻ, Báo Dân Việt, VietnamPlus (TTXVN):** Chùm bài viết chân dung anh Bùi Thanh Phú (thế hệ thứ 4 làm mắm, cựu giáo viên/Thạc sĩ CNTT khởi nghiệp giữ nghề, Nông dân Việt Nam xuất sắc).

---

<a name="phan-3-ho-so-thuong-hieu-chinh-thuc"></a>
## PHẦN 3: HỒ SƠ THƯƠNG HIỆU CHÍNH THỨC (BRAND PROFILE)

| Hạng mục | Giá trị xác thực | Nguồn gốc (Provenance) | Trạng thái xác minh |
| :--- | :--- | :--- | :--- |
| **Tên thương hiệu sản phẩm** | **Nước mắm Nam Ô — Hương Làng Cổ** | Chủ sở hữu cung cấp, Logo chính thức, Báo Đà Nẵng | `VERIFIED_OFFICIAL` |
| **Pháp nhân doanh nghiệp** | **CÔNG TY TNHH MẮM HỒNG HƯƠNG** | Cổng TT ĐKKD Quốc gia, Mã số thuế `0401801078` | `VERIFIED_EXTERNAL` |
| **Người sáng lập / Đại diện** | **Bùi Thanh Phú** (Sinh năm 1984) | Cổng ĐKKD, Báo Nhân Dân, Báo Dân Việt, TTXVN | `VERIFIED_EXTERNAL` |
| **Năm thành lập công ty** | **2016** (Nối tiếp truyền thống gia đình 4 đời) | Giấy phép ĐKKD (cấp 29/11/2016), Báo Đà Nẵng | `VERIFIED_EXTERNAL` |
| **Mã số thuế** | `0401801078` | Chi cục Thuế Quận Liên Chiểu, TP Đà Nẵng | `VERIFIED_EXTERNAL` |
| **Địa chỉ đăng ký kinh doanh** | Tổ 97 (nay thuộc Nam Ô 2), Phường Hòa Hiệp Nam, Quận Liên Chiểu, TP Đà Nẵng | Cổng TT ĐKKD Quốc gia | `VERIFIED_EXTERNAL` |
| **Địa chỉ xưởng sản xuất & Điểm tham quan** | Kiệt 884/74/4 Nguyễn Lương Bằng, Phường Hòa Hiệp Nam, Quận Liên Chiểu, TP Đà Nẵng | Sở Du lịch Đà Nẵng, Danang Fantasticity | `VERIFIED_EXTERNAL` |
| **Hotline / Điện thoại liên hệ** | `0935 998 908` | Cổng thông tin Du lịch Đà Nẵng & Fanpage | `VERIFIED_EXTERNAL` |
| **Email chính thức** | *Chưa công bố công khai* | *Để trống / Chờ chủ cơ sở cung cấp* | `NEEDS_OWNER_CONFIRMATION` |
| **Facebook Fanpage chính thức** | `https://www.facebook.com/huonglangco.vn` (`@huonglangco.vn`) | Link share do chủ sở hữu cung cấp | `VERIFIED_OFFICIAL` |
| **Kênh TikTok chính thức** | *Chưa xác định URL chính thức* | *Để trống, không bịa đặt* | `NEEDS_OWNER_CONFIRMATION` |
| **Kênh YouTube chính thức** | *Chưa xác định kênh thương hiệu riêng* | *Để trống, không bịa đặt* | `NEEDS_OWNER_CONFIRMATION` |
| **Website chính thức** | `huonglangco.vn` | Đăng ký thương hiệu / Fanpage | `VERIFIED_OFFICIAL` |
| **Chứng nhận chất lượng tiêu biểu**| • **OCOP 4 sao** (UBND Thành phố Đà Nẵng cấp)<br>• **Tiêu chuẩn an toàn thực phẩm HACCP**<br>• Làng nghề Di sản văn hóa phi vật thể Quốc gia | Quyết định UBND TP Đà Nẵng, Cục Du lịch Quốc gia, Báo Nhân Dân | `VERIFIED_EXTERNAL` |

---

<a name="phan-4-danh-muc-san-pham-xac-thuc"></a>
## PHẦN 4: DANH MỤC SẢN PHẨM XÁC THỰC (PRODUCT CATALOG & VARIANTS)

Tuyệt đối tuân thủ nguyên tắc: **Không tự ý ấn định giá bán cuối cùng nếu chưa có bảng giá niêm yết xuất xưởng từ chủ cơ sở.** Dưới đây là các sản phẩm cốt lõi đã được kiểm chứng bằng hình ảnh và tài liệu thực tế của cơ sở Hương Làng Cổ:

### Sản phẩm 1: Nước mắm Nam Ô Hương Làng Cổ — Chai thủy tinh 500ml (Sản phẩm chủ lực OCOP 4 sao)
* **Tên sản phẩm:** Nước mắm Nam Ô Hương Làng Cổ — Chai thủy tinh 500ml
* **Slug URL:** `nuoc-mam-nam-o-huong-lang-co-500ml`
* **Danh mục:** Nước mắm nhĩ truyền thống (`nuoc-mam-nhi-truyen-thong`)
* **Thành phần công bố:** 100% Cá cơm than tươi đánh bắt tại vùng biển Nam Ô (Đà Nẵng) và muối biển hạt tinh khiết Sa Huỳnh (ủ kho khử chát đắng). Tuyệt đối không chất bảo quản, không hương liệu nhân tạo, không phẩm màu.
* **Đặc tính sản phẩm:** Nước mắm nhĩ cốt nguyên chất đợt đầu, màu nâu cánh gián hổ phách trong veo, sóng sánh, mùi thơm nồng đặc trưng của mắm ủ chượp tự nhiên từ 12-18 tháng trong lu sành, vị đậm đà nơi đầu lưỡi và hậu vị ngọt sâu từ đạm cá tự nhiên.
* **Quy cách & Biến thể (Variant):**
  * **SKU:** `HLC-NM-500ML`
  * **Tên quy cách:** Chai thủy tinh 500ml
  * **Dung tích (Volume):** `0.500` | **Đơn vị (Unit):** `Chai`
  * **Giá tham khảo thị trường:** Dao động 75.000 đ – 85.000 đ / chai (tùy điểm phân phối).
  * **Giá đề xuất nhập hệ thống:** `NEEDS_OWNER_CONFIRMATION` *(Chờ chủ cơ sở nhập giá bán niêm yết chính thức tại website)*.
* **Trạng thái:** `VERIFIED_OFFICIAL` (Thông tin sản phẩm xác thực; Giá chờ chủ cơ sở xác nhận).

---

### Sản phẩm 2: Hộp quà đặc sản Nước mắm Nam Ô Hương Làng Cổ (Cặp 2 chai thủy tinh 500ml)
* **Tên sản phẩm:** Hộp quà đặc sản Nước mắm Nam Ô Hương Làng Cổ (Hộp 2 chai 500ml)
* **Slug URL:** `hop-qua-dac-san-nuoc-mam-nam-o-huong-lang-co-2-chai-500ml`
* **Danh mục:** Hộp quà biếu đặc sản (`hop-qua-bieu-dac-san`)
* **Thành phần:** 2 chai thủy tinh 500ml nước mắm nhĩ cá cơm than Nam Ô nguyên chất.
* **Bao bì:** Hộp giấy carton mỹ thuật thiết kế trang nhã mang đậm bản sắc văn hóa làng nghề truyền thống Nam Ô, có quai xách chắc chắn, thích hợp làm quà tặng đặc sản Đà Nẵng cho người thân, đối tác và khách du lịch.
* **Quy cách & Biến thể (Variant):**
  * **SKU:** `HLC-BOX-2X500ML`
  * **Tên quy cách:** Hộp 2 chai 500ml kèm quai xách
  * **Dung tích (Volume):** `1.000` | **Đơn vị (Unit):** `Hộp`
  * **Giá tham khảo thị trường:** Dao động 150.000 đ – 170.000 đ / hộp.
  * **Giá đề xuất nhập hệ thống:** `NEEDS_OWNER_CONFIRMATION` *(Chờ chủ cơ sở chốt giá)*.
* **Trạng thái:** `VERIFIED_OFFICIAL`.

---

### Sản phẩm 3: Nước mắm Nam Ô Hương Làng Cổ — Chai thủy tinh 250ml (Dung tích nhỏ tiện lợi)
* **Tên sản phẩm:** Nước mắm Nam Ô Hương Làng Cổ — Chai thủy tinh 250ml
* **Slug URL:** `nuoc-mam-nam-o-huong-lang-co-250ml`
* **Danh mục:** Nước mắm nhĩ truyền thống (`nuoc-mam-nhi-truyen-thong`)
* **Thành phần:** Cá cơm than Nam Ô và muối biển tinh khiết.
* **Quy cách & Biến thể (Variant):**
  * **SKU:** `HLC-NM-250ML`
  * **Tên quy cách:** Chai thủy tinh 250ml
  * **Dung tích (Volume):** `0.250` | **Đơn vị (Unit):** `Chai`
  * **Giá tham khảo thị trường:** 45.000 đ – 50.000 đ / chai.
  * **Giá đề xuất nhập hệ thống:** `NEEDS_OWNER_CONFIRMATION`.
* **Trạng thái:** `VERIFIED_EXTERNAL`.

---

### Dòng sản phẩm mở rộng ghi nhận tại làng nghề (Cần chủ cơ sở xác nhận có đưa lên web không):
* **Can 2 Lít / Can 5 Lít (Nước mắm nấu ăn / Nhà hàng):** `NEEDS_OWNER_CONFIRMATION`
* **Mắm nêm / Mắm ruốc Nam Ô Hương Làng Cổ:** Được một số du khách tìm kiếm khi đến xưởng; tuy nhiên sản phẩm chủ lực hiện diện trên nhãn hiệu Hương Làng Cổ là **Nước mắm nhĩ cá cơm than**. Do đó đánh dấu: `NEEDS_OWNER_CONFIRMATION` *(Chỉ thêm khi chủ cơ sở xác nhận có cung ứng)*.

---

<a name="phan-5-danh-muc-hinh-anh"></a>
## PHẦN 5: DANH MỤC HÌNH ẢNH & BẢN QUYỀN (IMAGE CATALOG)

Tuân thủ quy định: **Chỉ sử dụng tài sản hình ảnh chính thức do chủ sở hữu cung cấp, không lấy ảnh ngẫu nhiên trên mạng hay ảnh mắm của cơ sở khác.**

| File hình ảnh | Phân loại & Mục đích sử dụng | Nguồn gốc (Source Provenance) | Trạng thái bản quyền & Sử dụng |
| :--- | :--- | :--- | :--- |
| `/images/logo.jpg` | Logo tròn chính thức của thương hiệu (Nhãn Hương Làng Cổ - Nước Mắm Nam Ô) | Chủ sở hữu cung cấp trực tiếp | `VERIFIED_OFFICIAL` — Đã tích hợp tại Header và Footer |
| `/images/hero-banner.jpg` | Banner lớn trang chủ (Chụp thực tế chai mắm thủy tinh, nhãn logo Hương Làng Cổ, hộp quà biếu, thuyền thúng và làng chài) | Chủ sở hữu cung cấp trực tiếp | `VERIFIED_OFFICIAL` — Đã tích hợp tại Hero Banner trang chủ |
| *Ảnh chai đơn lập 500ml* | Ảnh thẻ sản phẩm và gallery trang chi tiết sản phẩm 500ml | Cần crop tách nền từ ảnh chụp thực tế của chủ cơ sở hoặc chủ cơ sở cung cấp bổ sung file ảnh sản phẩm nền trắng/phòng chụp | `NEEDS_OWNER_CONFIRMATION` |
| *Ảnh hộp quà 2 chai* | Ảnh thẻ sản phẩm cho biến thể Hộp quà biếu | Lấy từ bộ ảnh chụp sản phẩm thực tế của chủ cơ sở | `NEEDS_OWNER_CONFIRMATION` |

---

<a name="phan-6-danh-muc-bai-viet"></a>
## PHẦN 6: DANH MỤC BÀI VIẾT & DI SẢN VĂN HÓA (BLOG CONTENT MAP)

Các bài viết được biên soạn hoàn toàn dựa trên tư liệu lịch sử, báo chí chính thống và quyết định nhà nước, **không bịa đặt truyền thuyết hay ngụy tạo năm thành lập**:

### Danh mục bài viết (Blog Categories):
1. **Di sản làng nghề** (`di-san-lang-nghe`) — Các bài viết về lịch sử, truyền thống làng nghề Nam Ô và di sản quốc gia.
2. **Câu chuyện thương hiệu** (`cau-chuyen-thuong-hieu`) — Hành trình phục dựng nghề làm mắm của anh Bùi Thanh Phú và thương hiệu Hương Làng Cổ.
3. **Văn hóa ẩm thực & Bí quyết** (`van-hoa-am-thuc`) — Hướng dẫn thưởng thức nước mắm truyền thống chuẩn vị, cách bảo quản mắm nguyên chất.

---

### Bài viết 1: Làng nghề nước mắm Nam Ô: Hơn 400 năm lưu giữ giọt ngọc Di sản Quốc gia
* **Slug URL:** `lang-nghe-nuoc-mam-nam-o-di-san-van-hoa-phi-vat-the-quoc-gia`
* **Danh mục:** Di sản làng nghề (`di-san-lang-nghe`)
* **Tóm tắt (Excerpt):** Nằm dưới chân đèo Hải Vân bên vịnh Đà Nẵng, làng chài cổ Nam Ô đã trải qua hơn bốn thế kỷ thăng trầm để giữ trọn nghề làm nước mắm truyền thống bằng cá cơm than và muối biển, được vinh danh là Di sản văn hóa phi vật thể Quốc gia.
* **Nguồn tư liệu xác thực:**
  - Quyết định số 2974/QĐ-BVHTTDL ngày 27/8/2019 của Bộ Văn hóa, Thể thao và Du lịch.
  - Cổng thông tin điện tử Thành phố Đà Nẵng & Cục Du lịch Quốc gia Việt Nam.
* **Nội dung cốt lõi:**
  1. Lịch sử hình thành làng chài cổ Nam Ô bên cửa sông Cu Đê, chân đèo Hải Vân.
  2. Nước mắm Nam Ô từng là sản vật tiến vua nức tiếng xứ Đàng Trong nhờ độ thơm ngon đặc biệt.
  3. Giá trị của việc được công nhận Di sản văn hóa phi vật thể Quốc gia năm 2019 và đề án bảo tồn làng nghề truyền thống của UBND TP Đà Nẵng.
* **Trạng thái:** `VERIFIED_EXTERNAL` (Sẵn sàng xuất bản).

---

### Bài viết 2: Hương Làng Cổ: Tâm huyết giữ hồn nước mắm truyền thống của người con đất Nam Ô
* **Slug URL:** `huong-lang-co-tam-huyet-giu-hon-nuoc-mam-nam-o`
* **Danh mục:** Câu chuyện thương hiệu (`cau-chuyen-thuong-hieu`)
* **Tóm tắt (Excerpt):** Rời bục giảng và tấm bằng Thạc sĩ Công nghệ thông tin, anh Bùi Thanh Phú trở về nối nghiệp truyền thống 4 đời của gia đình, sáng lập thương hiệu Nước mắm Hương Làng Cổ với khát vọng đưa giọt mắm Nam Ô vươn xa.
* **Nguồn tư liệu xác thực:**
  - Báo Đà Nẵng (baodanang.vn) — Bài viết về khởi nghiệp làng nghề Nam Ô.
  - Báo Nhân Dân, Báo Dân Việt, Thông tấn xã Việt Nam (VietnamPlus).
* **Nội dung cốt lõi:**
  1. Câu chuyện khởi nghiệp từ năm 2016 của anh Bùi Thanh Phú — người con sinh ra và lớn lên cùng mùi mắm mặn mòi của làng Nam Ô.
  2. Sự kiên định giữ phương pháp ủ chượp tự nhiên trong lu sành suốt 12 - 18 tháng, chắt lọc bằng phễu tre truyền thống thay vì can thiệp phụ gia công nghiệp.
  3. Ứng dụng công nghệ, chuẩn hóa tem nhãn truy xuất nguồn gốc, xây dựng mô hình du lịch trải nghiệm làng nghề đón du khách trong và ngoài nước.
  4. Danh hiệu "Nông dân Việt Nam xuất sắc" ghi nhận những đóng góp cho cộng đồng làng nghề địa phương.
* **Trạng thái:** `VERIFIED_EXTERNAL` (Sẵn sàng xuất bản).

---

### Bài viết 3: Nước mắm Nam Ô Hương Làng Cổ đạt chuẩn OCOP 4 sao và HACCP: Khẳng định chất lượng đỉnh cao
* **Slug URL:** `nuoc-mam-nam-o-huong-lang-co-dat-chuan-ocop-4-sao-haccp`
* **Danh mục:** Văn hóa ẩm thực & Bí quyết (`van-hoa-am-thuc`)
* **Tóm tắt (Excerpt):** Không chỉ giữ trọn vị mắm xưa, Nước mắm Nam Ô Hương Làng Cổ đã được UBND TP Đà Nẵng chứng nhận đạt chuẩn OCOP 4 sao và chứng nhận quốc tế HACCP, đảm bảo an toàn tuyệt đối cho bữa ăn gia đình.
* **Nguồn tư liệu xác thực:**
  - Kết quả đánh giá phân hạng sản phẩm OCOP của Hội đồng OCOP Thành phố Đà Nẵng.
  - Cổng thông tin Sở Du lịch Đà Nẵng (Danang Fantasticity).
* **Nội dung cốt lõi:**
  1. Ý nghĩa của chứng nhận OCOP 4 sao đối với sản phẩm đặc sản truyền thống Đà Nẵng.
  2. Quy chuẩn kiểm soát chất lượng khắt khe từ khâu tuyển chọn cá cơm than tháng Ba âm lịch và muối Sa Huỳnh ủ kho 1 năm để loại bỏ vị chát đắng.
  3. Áp dụng hệ thống quản lý an toàn thực phẩm HACCP trong cơ sở sản xuất thủ công mà vẫn bảo toàn phương pháp cổ truyền.
* **Trạng thái:** `VERIFIED_EXTERNAL` (Sẵn sàng xuất bản).

---

<a name="phan-7-bao-cao-xung-dot-du-lieu"></a>
## PHẦN 7: BÁO CÁO XUNG ĐỘT DỮ LIỆU (CONFLICT REPORT)

Trong quá trình rà soát dữ liệu thị trường, đã phát hiện một số điểm chênh lệch giữa các nguồn thứ cấp và nguồn chính thức:

| Hạng mục | Nguồn A (Đại lý / Thứ cấp) | Nguồn B (Chính sách xưởng / Nhà nước) | Đánh giá & Khuyến nghị xử lý |
| :--- | :--- | :--- | :--- |
| **Giá bán chai 500ml** | Một số sàn đặc sản niêm yết: **48.000 đ – 60.000 đ** (dòng chai nhựa/loại 2), trong khi dòng chai thủy tinh cao cấp OCOP là **75.000 đ – 85.000 đ**. | Chưa có bảng giá trực tiếp từ xưởng trên website. | **XUNG ĐỘT MỨC GIÁ:** Không tự chọn giá đại lý. Để giá trạng thái `NEEDS_OWNER_CONFIRMATION` và chờ chủ cơ sở cung cấp bảng giá bán lẻ chính thức trên website. |
| **Dung tích chai nhỏ** | Một số bài viết nhắc đến chai **250ml**, một số nơi ghi **300ml**. | Tùy lô bao bì thủy tinh từng thời kỳ của cơ sở sản xuất. | Khuyến nghị ưu tiên niêm yết dòng **500ml** (sản phẩm chủ lực có trên banner) và chờ chủ cơ sở xác nhận quy cách chai nhỏ hiện tại. |
| **Kênh TikTok** | Một số kênh review cá nhân quay tại xưởng Hương Làng Cổ với lượng view lớn nhưng là tài khoản Tiktoker cá nhân. | Chưa có kênh TikTok doanh nghiệp chính thức được tích hợp. | **TỪ CHỐI DẪN LINK:** Không liên kết tài khoản cá nhân của reviewer vào `store_settings.tiktok_url`. Để trống trường này cho đến khi chủ cơ sở lập kênh chính thức. |

---

<a name="phan-8-du-lieu-can-xac-nhan"></a>
## PHẦN 8: DỮ LIỆU CẦN CHỦ CƠ SỞ XÁC NHẬN (UNKNOWN DATA)

Để website hoạt động hoàn chỉnh và đảm bảo tính pháp lý, đề nghị Chủ sở hữu xác nhận các mục sau:

1. **Bảng giá bán lẻ chính thức trên Website:**
   * Chai thủy tinh 500ml: Giá bao nhiêu VNĐ? (Có giá gạch so sánh không?)
   * Hộp quà 2 chai 500ml: Giá bao nhiêu VNĐ?
   * Có bán dòng chai 250ml hoặc can 2L/5L trên website không?
2. **Số lượng tồn kho ban đầu (Inventory):**
   * Số lượng chai 500ml sẵn sàng bán online.
   * Số lượng hộp quà sẵn sàng bán online.
3. **Chính sách vận chuyển (Shipping):**
   * Phí ship cố định nội thành Đà Nẵng và toàn quốc (Ví dụ: 25.000 đ hay 30.000 đ?).
   * Có áp dụng Freeship cho đơn hàng từ mức nào không? (Ví dụ: Đơn từ 300.000 đ hoặc từ 2 hộp).
4. **Tài khoản ngân hàng thanh toán (Bank Transfer):**
   * Tên ngân hàng, Số tài khoản, Tên chủ tài khoản, Chi nhánh (Nếu muốn kích hoạt phương thức Chuyển khoản ngân hàng tự động).
5. **Email liên hệ hỗ trợ:**
   * Địa chỉ email chính thức tiếp nhận thông báo đơn hàng và liên hệ khách hàng (Ví dụ: `huonglangco.namo@gmail.com` hay email nào khác).

---

<a name="phan-9-ke-hoach-nap-du-lieu-an-toan"></a>
## PHẦN 9: KẾ HOẠCH NẠP DỮ LIỆU AN TOÀN (DATABASE IMPORT PLAN)

Tuân thủ nghiêm ngặt **Quy tắc an toàn Database (PART 12 & PART 17)**:
- **KHÔNG** xóa bất kỳ bảng nào, không chạy migration phá hủy.
- **KHÔNG** xóa tài khoản admin hiện có.
- **KHÔNG** xóa giỏ hàng hay cấu trúc hiện tại.
- Kịch bản nạp (Seed Script) sẽ sử dụng cơ chế `INSERT ... ON DUPLICATE KEY UPDATE` dựa trên các khóa định danh duy nhất (`slug`, `platform`, `id`).

### Dự thảo các bản ghi an toàn sẽ nạp sau khi Chủ cơ sở phê duyệt:

#### 1. Cập nhật `store_settings` (ID = 1):
```sql
UPDATE store_settings SET
  store_name = 'Nước mắm Nam Ô Hương Làng Cổ',
  store_description = 'Đặc sản nước mắm truyền thống Nam Ô hơn 400 năm tuổi đạt chuẩn OCOP 4 sao và HACCP. Nguyên chất cá cơm than và muối biển Sa Huỳnh ủ chượp tự nhiên trong lu sành.',
  logo_url = '/images/logo.jpg',
  store_address = 'Tổ 97 (Nam Ô 2), Kiệt 884/74/4 Nguyễn Lương Bằng, Phường Hòa Hiệp Nam, Quận Liên Chiểu, TP. Đà Nẵng',
  contact_phone = '0935 998 908',
  facebook_url = 'https://www.facebook.com/huonglangco.vn',
  cod_enabled = 1,
  updated_at = NOW()
WHERE id = 1;
```

#### 2. Nạp Danh mục sản phẩm `categories`:
```sql
INSERT INTO categories (name, slug, description, image_url, status, sort_order)
VALUES
('Nước mắm nhĩ truyền thống', 'nuoc-mam-nhi-truyen-thong', 'Nước mắm nhĩ cá cơm than ủ chượp thủ công 12-18 tháng trong lu sành, nguyên chất chuẩn vị Nam Ô', NULL, 'ACTIVE', 1),
('Hộp quà biếu đặc sản', 'hop-qua-bieu-dac-san', 'Các combo hộp quà nước mắm Nam Ô cao cấp, sang trọng, thích hợp làm quà tặng ý nghĩa', NULL, 'ACTIVE', 2)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), status = VALUES(status);
```

#### 3. Nạp Danh mục bài viết `blog_categories`:
```sql
INSERT INTO blog_categories (name, slug, description, status, sort_order)
VALUES
('Di sản làng nghề', 'di-san-lang-nghe', 'Lịch sử và văn hóa làng nghề nước mắm Nam Ô hơn 400 năm', 'ACTIVE', 1),
('Câu chuyện thương hiệu', 'cau-chuyen-thuong-hieu', 'Hành trình giữ hồn giọt ngọc Nam Ô của thương hiệu Hương Làng Cổ', 'ACTIVE', 2),
('Văn hóa ẩm thực', 'van-hoa-am-thuc', 'Bí quyết ẩm thực và tinh hoa nước mắm truyền thống', 'ACTIVE', 3)
ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status);
```

#### 4. Nạp Banner trang chủ `banners`:
```sql
INSERT INTO banners (title, image_url, link_url, sort_order, is_active, start_at, end_at)
VALUES
('Nước mắm Nam Ô Hương Làng Cổ - Tinh hoa ẩm thực Việt', '/images/hero-banner.jpg', '/products', 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 5 YEAR))
ON DUPLICATE KEY UPDATE title = VALUES(title), image_url = VALUES(image_url), is_active = VALUES(is_active);
```

---

## KẾT LUẬN & TRẠNG THÁI HIỆN TẠI

* Nghiên cứu thực tế và đối soát nguồn thông tin thương hiệu **Nước Mắm Nam Ô — Hương Làng Cổ** đã hoàn tất với độ chính xác cao dựa trên hồ sơ pháp nhân, cổng du lịch chính thức của TP Đà Nẵng, báo chí trung ương và tài sản do chủ sở hữu cung cấp.
* Toàn bộ cấu trúc mapping giữa thông tin thực tế, trường cơ sở dữ liệu và vị trí hiển thị trên website đã được thiết lập rõ ràng.
* **Tuân thủ đúng quy tắc PART 17:** Đại diện kỹ thuật **DỪNG LẠI TẠI ĐÂY**, không can thiệp hay thay đổi cơ sở dữ liệu sản xuất cho đến khi Chủ cơ sở xem xét báo cáo này và phê duyệt bảng giá bán lẻ cũng như các thông tin cần xác nhận.
