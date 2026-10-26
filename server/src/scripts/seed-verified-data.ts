import dotenv from "dotenv";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import mysql from "mysql2/promise";

dotenv.config();

async function seedVerifiedData(): Promise<void> {
  const required = ["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER"] as const;
  if (required.some((key) => !process.env[key]) || process.env.DATABASE_PASSWORD === undefined) {
    throw new Error("Database connection configuration is incomplete");
  }

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    charset: "utf8mb4",
  });

  try {
    await connection.beginTransaction();

    console.info("1. Cập nhật thông tin cửa hàng (store_settings)...");
    await connection.execute(`
      UPDATE store_settings SET
        store_name = 'Nước mắm Nam Ô Hương Làng Cổ',
        store_description = 'Đặc sản nước mắm truyền thống Nam Ô hơn 400 năm tuổi đạt chuẩn OCOP 4 sao và HACCP. Nguyên chất cá cơm than và muối biển Sa Huỳnh ủ chượp tự nhiên trong lu sành.',
        logo_url = '/images/logo.jpg',
        store_address = 'Tổ 97 (Nam Ô 2), Kiệt 884/74/4 Nguyễn Lương Bằng, Phường Hòa Hiệp Nam, Quận Liên Chiểu, TP. Đà Nẵng',
        contact_phone = '0935 998 908',
        contact_email = 'huonglangco.namo@gmail.com',
        shipping_fee = 30000.00,
        free_shipping_enabled = 1,
        free_shipping_minimum = 300000.00,
        cod_enabled = 1,
        bank_transfer_enabled = 1,
        bank_name = 'ACMEBank',
        bank_account_number = '3897126450',
        bank_account_holder = 'NGUYEN NGUYEN PHUC',
        bank_branch = 'SePay Sandbox (TK ảo: SBPAY9735061428)',
        facebook_url = 'https://www.facebook.com/huonglangco.vn',
        updated_at = NOW()
      WHERE id = 1
    `);

    console.info("2. Cập nhật liên kết mạng xã hội (social_links)...");
    await connection.execute(`
      INSERT INTO social_links (platform, name, url, icon, is_active, sort_order)
      VALUES ('FACEBOOK', 'Facebook', 'https://www.facebook.com/huonglangco.vn', 'facebook', 1, 0)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        url = VALUES(url),
        icon = VALUES(icon),
        is_active = VALUES(is_active),
        sort_order = VALUES(sort_order)
    `);

    console.info("3. Cập nhật danh mục sản phẩm (categories)...");
    await connection.execute(`
      INSERT INTO categories (name, slug, description, image_url, status, sort_order)
      VALUES
        ('Nước mắm nhĩ truyền thống', 'nuoc-mam-nhi-truyen-thong', 'Nước mắm nhĩ cá cơm than ủ chượp thủ công 12-18 tháng trong lu sành, nguyên chất chuẩn vị Nam Ô', NULL, 'ACTIVE', 1),
        ('Hộp quà biếu đặc sản', 'hop-qua-bieu-dac-san', 'Các combo hộp quà nước mắm Nam Ô cao cấp, sang trọng, thích hợp làm quà tặng ý nghĩa', NULL, 'ACTIVE', 2)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        status = VALUES(status),
        sort_order = VALUES(sort_order)
    `);

    // Lấy ID danh mục
    const [categories] = await connection.execute<RowDataPacket[]>(
      "SELECT id, slug FROM categories WHERE slug IN ('nuoc-mam-nhi-truyen-thong', 'hop-qua-bieu-dac-san')",
    );
    const catMap = new Map(categories.map((c) => [c.slug, c.id]));
    const traditionalCatId = catMap.get("nuoc-mam-nhi-truyen-thong");
    const giftCatId = catMap.get("hop-qua-bieu-dac-san");

    if (!traditionalCatId || !giftCatId) {
      throw new Error("Không tìm thấy ID danh mục vừa tạo");
    }

    console.info("4. Cập nhật sản phẩm, biến thể, hình ảnh và kho hàng...");

    const productsData = [
      {
        name: "Nước mắm Nam Ô Hương Làng Cổ — Chai thủy tinh 500ml",
        slug: "nuoc-mam-nam-o-huong-lang-co-500ml",
        categoryId: traditionalCatId,
        shortDescription: "Nước mắm nhĩ cá cơm than Nam Ô đạt chuẩn OCOP 4 sao và HACCP, ủ chượp tự nhiên trong lu sành từ 12-18 tháng.",
        description: `### Nước mắm Nam Ô Hương Làng Cổ — Chai thủy tinh 500ml

**Đặc sản truyền thống tiến vua đạt chuẩn OCOP 4 sao và tiêu chuẩn quốc tế HACCP.**

#### 1. Thành phần nguyên chất
* **100% Cá cơm than tươi:** Được đánh bắt tại vùng biển Nam Ô dưới chân đèo Hải Vân vào vụ cá béo nhất (tháng Ba âm lịch).
* **Muối hạt Sa Huỳnh:** Muối tinh khiết được lưu kho trữ trên 1 năm để loại bỏ vị đắng chát tự nhiên của muối non, chỉ giữ lại vị mặn thanh thuần khiết.
* **Hoàn toàn không chất bảo quản, không hương liệu nhân tạo, không phẩm màu.**

#### 2. Quy trình sản xuất thủ công làng nghề hơn 400 năm
* Cá và muối được trộn theo tỷ lệ vàng truyền thống **3 cá : 1 muối**, sau đó đưa vào các chum, vại lu sành cổ truyền.
* Ủ chượp tự nhiên dưới nắng gió miền Trung suốt **12 đến 18 tháng** cho đến khi cá ngấu hoàn toàn.
* Chắt lọc thủ công từng giọt qua phễu tre lót vải mịn truyền thống để thu được dòng nước mắm nhĩ đầu tiên.

#### 3. Đặc điểm cảm quan
* **Màu sắc:** Đỏ nâu cánh gián hổ phách trong veo, sóng sánh khi rót.
* **Mùi vị:** Hương thơm nồng nàn đặc trưng của mắm cá cơm ủ chín, vị mặn mòi nơi đầu lưỡi và hậu vị ngọt sâu béo bùi từ đạm cá tự nhiên.
* **Quy cách đóng gói:** Chai thủy tinh 500ml cao cấp bảo quản chất lượng nguyên bản.

#### 4. Hướng dẫn sử dụng & bảo quản
* Dùng chấm trực tiếp cùng các món luộc, hấp, bánh tráng cuốn thịt heo Đà Nẵng, hoặc nêm nếm món ăn gia đình.
* Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp. Đậy kín nắp sau khi sử dụng.`,
        variant: {
          sku: "HLC-NM-500ML",
          name: "Chai thủy tinh 500ml",
          volume: 0.5,
          unit: "Chai",
          price: 85000,
          comparePrice: 95000,
          stock: 150,
        },
        image: {
          url: "/images/hero-banner.jpg",
          alt: "Chai Nước mắm Nam Ô Hương Làng Cổ 500ml",
        },
      },
      {
        name: "Hộp quà đặc sản Nước mắm Nam Ô Hương Làng Cổ (2 chai 500ml)",
        slug: "hop-qua-dac-san-nuoc-mam-nam-o-huong-lang-co-2-chai-500ml",
        categoryId: giftCatId,
        shortDescription: "Bộ quà tặng 2 chai thủy tinh 500ml nước mắm nhĩ Nam Ô cao cấp kèm hộp mỹ thuật có quai xách sang trọng, ý nghĩa.",
        description: `### Hộp quà đặc sản Nước mắm Nam Ô Hương Làng Cổ (2 chai 500ml)

**Món quà ẩm thực tinh túy từ làng nghề Di sản văn hóa phi vật thể Quốc gia.**

#### 1. Quy cách hộp quà cao cấp
* **Gồm 2 chai thủy tinh 500ml** Nước mắm nhĩ Nam Ô Hương Làng Cổ OCOP 4 sao.
* **Hộp giấy carton mỹ thuật** in ấn hoa văn làng chài cổ Nam Ô trang nhã, quai xách chắc chắn, thích hợp làm quà biếu đối tác, doanh nghiệp, người thân và du khách phương xa khi đến Đà Nẵng.

#### 2. Giá trị truyền thống trao gửi
* Trao tặng nước mắm truyền thống trong văn hóa Việt là gửi gắm lời chúc ấm no, gắn kết bền chặt và hương vị đầm ấm cho mâm cơm gia đình.
* Nước mắm Nam Ô Hương Làng Cổ được chắt lọc từ tinh hoa cá cơm than và muối Sa Huỳnh, ủ lu sành 12-18 tháng nguyên chất.`,
        variant: {
          sku: "HLC-BOX-2X500ML",
          name: "Hộp 2 chai 500ml",
          volume: 1.0,
          unit: "Hộp",
          price: 175000,
          comparePrice: 195000,
          stock: 80,
        },
        image: {
          url: "/images/hero-banner.jpg",
          alt: "Hộp quà 2 chai Nước mắm Nam Ô Hương Làng Cổ 500ml",
        },
      },
      {
        name: "Nước mắm Nam Ô Hương Làng Cổ — Chai thủy tinh 250ml",
        slug: "nuoc-mam-nam-o-huong-lang-co-250ml",
        categoryId: traditionalCatId,
        shortDescription: "Dung tích nhỏ 250ml tiện lợi, giữ nguyên vẹn chất lượng mắm nhĩ cá cơm than Nam Ô OCOP 4 sao.",
        description: `### Nước mắm Nam Ô Hương Làng Cổ — Chai thủy tinh 250ml

**Phiên bản nhỏ gọn tiện lợi dành cho gia đình nhỏ hoặc du khách trải nghiệm.**

* **Thành phần:** 100% Cá cơm than tươi Nam Ô và muối biển Sa Huỳnh.
* **Quy trình:** Ủ chượp tự nhiên trong lu sành từ 12 đến 18 tháng.
* **Dung tích:** Chai thủy tinh 250ml nhỏ gọn, dễ dàng mang theo khi du lịch hoặc dùng thử.`,
        variant: {
          sku: "HLC-NM-250ML",
          name: "Chai thủy tinh 250ml",
          volume: 0.25,
          unit: "Chai",
          price: 48000,
          comparePrice: 55000,
          stock: 100,
        },
        image: {
          url: "/images/hero-banner.jpg",
          alt: "Chai Nước mắm Nam Ô Hương Làng Cổ 250ml",
        },
      },
    ];

    for (const p of productsData) {
      await connection.execute(`
        INSERT INTO products (category_id, name, slug, short_description, description, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
        ON DUPLICATE KEY UPDATE
          category_id = VALUES(category_id),
          name = VALUES(name),
          short_description = VALUES(short_description),
          description = VALUES(description),
          status = 'ACTIVE'
      `, [p.categoryId, p.name, p.slug, p.shortDescription, p.description]);

      const [pRows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM products WHERE slug = ?",
        [p.slug],
      );
      const productId = pRows[0]?.id;
      if (!productId) continue;

      // Variant
      await connection.execute(`
        INSERT INTO product_variants (product_id, sku, name, volume, unit, price, compare_price, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        ON DUPLICATE KEY UPDATE
          product_id = VALUES(product_id),
          name = VALUES(name),
          volume = VALUES(volume),
          unit = VALUES(unit),
          price = VALUES(price),
          compare_price = VALUES(compare_price),
          status = 'ACTIVE'
      `, [
        productId,
        p.variant.sku,
        p.variant.name,
        p.variant.volume,
        p.variant.unit,
        p.variant.price,
        p.variant.comparePrice,
      ]);

      const [vRows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM product_variants WHERE sku = ?",
        [p.variant.sku],
      );
      const variantId = vRows[0]?.id;

      // Inventory
      if (variantId) {
        await connection.execute(`
          INSERT INTO inventory (variant_id, quantity, reserved_quantity)
          VALUES (?, ?, 0)
          ON DUPLICATE KEY UPDATE
            quantity = VALUES(quantity)
        `, [variantId, p.variant.stock]);
      }

      // Image
      // Xóa ảnh cũ của product nếu có trước khi thêm primary image duy nhất
      await connection.execute("DELETE FROM product_images WHERE product_id = ?", [productId]);
      await connection.execute(`
        INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
        VALUES (?, ?, ?, 1, 0)
      `, [productId, p.image.url, p.image.alt]);
    }

    console.info("5. Cập nhật danh mục bài viết (blog_categories)...");
    await connection.execute(`
      INSERT INTO blog_categories (name, slug, description, status, sort_order)
      VALUES
        ('Di sản làng nghề', 'di-san-lang-nghe', 'Lịch sử và văn hóa làng nghề nước mắm Nam Ô hơn 400 năm', 'ACTIVE', 1),
        ('Câu chuyện thương hiệu', 'cau-chuyen-thuong-hieu', 'Hành trình giữ hồn giọt ngọc Nam Ô của thương hiệu Hương Làng Cổ', 'ACTIVE', 2),
        ('Văn hóa ẩm thực', 'van-hoa-am-thuc', 'Bí quyết ẩm thực và tinh hoa nước mắm truyền thống', 'ACTIVE', 3)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        status = VALUES(status),
        sort_order = VALUES(sort_order)
    `);

    const [blogCats] = await connection.execute<RowDataPacket[]>(
      "SELECT id, slug FROM blog_categories WHERE slug IN ('di-san-lang-nghe', 'cau-chuyen-thuong-hieu', 'van-hoa-am-thuc')",
    );
    const bCatMap = new Map(blogCats.map((c) => [c.slug, c.id]));
    const heritageCatId = bCatMap.get("di-san-lang-nghe");
    const storyCatId = bCatMap.get("cau-chuyen-thuong-hieu");
    const cultureCatId = bCatMap.get("van-hoa-am-thuc");

    console.info("6. Cập nhật bài viết bài đọc (blog_posts)...");
    const postsData = [
      {
        title: "Làng nghề nước mắm Nam Ô: Hơn 400 năm lưu giữ giọt ngọc Di sản Quốc gia",
        slug: "lang-nghe-nuoc-mam-nam-o-di-san-van-hoa-phi-vat-the-quoc-gia",
        categoryId: heritageCatId,
        excerpt: "Nằm dưới chân đèo Hải Vân bên vịnh Đà Nẵng, làng chài cổ Nam Ô đã trải qua hơn bốn thế kỷ thăng trầm để giữ trọn nghề làm nước mắm truyền thống bằng cá cơm than và muối biển, được vinh danh là Di sản văn hóa phi vật thể Quốc gia.",
        thumbnailUrl: "/images/hero-banner.jpg",
        content: `Nằm dưới chân đèo Hải Vân hùng vĩ, nép mình bên bờ vịnh Đà Nẵng và cửa sông Cu Đê, làng chài cổ Nam Ô (phường Hòa Hiệp Nam, quận Liên Chiểu, thành phố Đà Nẵng) đã có lịch sử hình thành hơn 700 năm. Nơi đây từ lâu đã nổi tiếng khắp cả nước với nghề làm nước mắm truyền thống độc đáo có niên đại trên 4 thế kỷ.

### Di sản văn hóa phi vật thể Quốc gia
Ngày 27/8/2019, Bộ Văn hóa, Thể thao và Du lịch đã ban hành Quyết định số 2974/QĐ-BVHTTDL chính thức công nhận **Nghề làm nước mắm Nam Ô** là **Di sản văn hóa phi vật thể Quốc gia**. Đây là niềm tự hào to lớn của người dân xứ Quảng và là sự khẳng định xứng đáng cho những giá trị văn hóa, lịch sử và tri thức dân gian truyền đời.

### Tinh hoa từ cá cơm than và muối Sa Huỳnh
Khác với nước mắm nhiều vùng miền khác, nước mắm Nam Ô chỉ sử dụng duy nhất cá cơm than tươi sống được ngư dân đánh bắt vào vụ tháng Ba âm lịch — thời điểm cá béo mẫm và đạt độ đạm cao nhất. Muối ủ cá phải là muối hạt Sa Huỳnh (Quảng Ngãi) hoặc Cà Ná hạt to, đều và trắng trong. Đặc biệt, muối phải được lưu kho ít nhất 1 năm để lắng đọng và chảy hết chất chát đắng (ion magie, canxi), chỉ còn lại vị mặn ngọt thanh khiết.

### Ủ chượp lu sành 12 - 18 tháng
Hồn cốt của nước mắm Nam Ô nằm ở việc ủ chượp tự nhiên trong các chum, vại lu sành làm từ đất nung truyền thống. Dưới nắng gió miền Trung, từng mẻ cá và muối được ngấu dần qua 12 đến 18 tháng. Giọt nước mắm nhĩ chắt ra có màu đỏ cánh gián hổ phách trong suốt, hương thơm nồng đượm và vị ngọt sâu khó quên.`,
      },
      {
        title: "Hương Làng Cổ: Tâm huyết giữ hồn nước mắm truyền thống của người con đất Nam Ô",
        slug: "huong-lang-co-tam-huyet-giu-hon-nuoc-mam-nam-o",
        categoryId: storyCatId,
        excerpt: "Rời bục giảng và tấm bằng Thạc sĩ Công nghệ thông tin, anh Bùi Thanh Phú trở về nối nghiệp truyền thống 4 đời của gia đình, sáng lập thương hiệu Nước mắm Hương Làng Cổ với khát vọng đưa giọt mắm Nam Ô vươn xa.",
        thumbnailUrl: "/images/hero-banner.jpg",
        content: `Sinh ra và lớn lên trong mùi mắm mặn mòi quen thuộc của làng chài Nam Ô, anh Bùi Thanh Phú (sinh năm 1984) là thế hệ thứ 4 trong gia đình có nghề làm nước mắm truyền thống. Từng tốt nghiệp Thạc sĩ Khoa học máy tính và có công việc giảng dạy ổn định, nhưng nỗi trăn trở trước sự mai một của làng nghề đã thôi thúc anh rẽ hướng.

### Khởi nghiệp từ năm 2016
Năm 2016, anh Phú quyết định thành lập Công ty TNHH Mắm Hồng Hương và khai sinh thương hiệu **Nước mắm Nam Ô — Hương Làng Cổ**. Tên gọi "Hương Làng Cổ" chính là lời nhắc nhớ về nguồn cội, về hương thơm đặc trưng của một làng nghề cổ kính đã nuôi dưỡng bao thế hệ.

### Giữ trọn phương pháp thủ công
Trước làn sóng cạnh tranh của nước mắm công nghiệp, anh Phú kiên định nói không với hóa chất, phụ gia hay chất điều vị. Toàn bộ quy trình từ khâu ủ mắm bằng lu sành đến lọc bằng phễu tre truyền thống đều được tuân thủ nghiêm ngặt theo bí quyết gia truyền. 

Bên cạnh đó, với tư duy công nghệ, anh Phú đã đầu tư nâng cấp nhãn mác, bao bì chai thủy tinh sang trọng, chuẩn hóa tem truy xuất nguồn gốc QR và kết nối mô hình du lịch trải nghiệm làng nghề. Cơ sở Hương Làng Cổ trở thành điểm đến hấp dẫn đón hàng ngàn lượt khách du lịch và học sinh, sinh viên đến tham quan tìm hiểu quy trình làm mắm cổ truyền.

Nhờ những nỗ lực bền bỉ, anh Bùi Thanh Phú đã được Trung ương Hội Nông dân Việt Nam vinh danh là **Nông dân Việt Nam xuất sắc**, góp phần thắp sáng ngọn lửa tự hào cho thế hệ trẻ làm nghề truyền thống.`,
      },
      {
        title: "Bỏ bằng Thạc sĩ IT về với lu sành: Lời tâm sự từ đáy lòng của chủ thương hiệu Hương Làng Cổ",
        slug: "bo-bang-thac-si-it-ve-voi-lu-sanh-tam-su-bui-thanh-phu",
        categoryId: storyCatId,
        excerpt: "Từng trải qua giai đoạn 'chiến tranh lạnh' với gia đình vì từ bỏ công việc giảng dạy để về làm mắm, anh Bùi Thanh Phú chia sẻ lý do kiên định giữ nghề và triết lý sâu sắc: 'Quê hương trong tôi là mùi nước mắm'.",
        thumbnailUrl: "/images/hero-banner.jpg",
        content: `"Có người từng bảo tôi khùng. Học xong Thạc sĩ Khoa học máy tính ở trường Đại học Bách Khoa, có công việc đứng trên bục giảng ổn định nơi phố thị, tại sao lại đâm đầu về làm bạn với lu sành, với cá và muối mặn mòi quanh năm mùi mắm?" — Đó là lời mở đầu đầy chân thành của anh Bùi Thanh Phú khi nhớ lại khúc rẽ định mệnh của đời mình năm 2016.

### Nỗi lòng của cha mẹ và chuỗi ngày "chiến tranh lạnh"
Sinh ra trong một gia đình 4 đời làm nghề mắm tại làng chài Nam Ô, anh Phú thấu hiểu nỗi vất vả cùng cực của cha mẹ. Những đêm đông buốt giá thức dậy từ 3-4 giờ sáng đón thuyền cá cơm cập bến, những ngày hè đổ lửa dầm mình bên các chum mắm nồng nặc mùi chượp. Bố mẹ anh chắt chiu từng đồng nuôi con ăn học chỉ với mong ước duy nhất: con thoát ly khỏi cái nghề nhọc nhằn này.

Bởi vậy, ngày anh cầm tấm bằng Thạc sĩ về thưa chuyện muốn mở xưởng mắm gia đình thành công ty, cả nhà bàng hoàng phản đối. Đã có những tháng ngày "chiến tranh lạnh" nặng nề, cha mẹ không nhìn mặt, bạn bè hoài nghi. Nhưng ngọn lửa nghề và nỗi sợ làng mắm cổ hơn 400 năm bị đô thị hóa xóa sổ đã thôi thúc anh không thể lùi bước.

### Triết lý: "Quê hương trong tôi là mùi nước mắm"
"Mỗi lần đi xa, điều tôi nhớ nhất về Nam Ô không phải là cảnh đẹp, mà là cái mùi mắm mặn mòi nồng đượm len lỏi trong từng ngõ ngách, bám vào da thịt từ thuở lọt lòng. Nếu thế hệ trẻ chúng tôi ai cũng rời làng đi tìm việc nhàn hạ, thì 10 hay 20 năm nữa, ai sẽ là người giữ giọt ngọc của tổ tiên?" — anh Phú tâm sự.

Mang tư duy của một người làm công nghệ, anh Phú bắt tay vào chuẩn hóa từng khâu: giữ trọn vẹn phương pháp ủ chượp thủ công trong lu sành truyền thống, nhưng đầu tư bài bản hệ thống tem mã QR truy xuất nguồn gốc, thiết kế chai thủy tinh sang trọng, đăng ký bảo hộ thương hiệu Hương Làng Cổ và chứng nhận OCOP.

### Thành quả của sự kiên định
Từ một xưởng mắm nhỏ đứng trước nguy cơ mai một, Nước mắm Nam Ô — Hương Làng Cổ hôm nay đã vươn mình thành thương hiệu OCOP 4 sao tiêu biểu, đạt chuẩn quốc tế HACCP, có mặt tại các hệ thống đặc sản uy tín và đón hàng ngàn lượt khách du lịch trải nghiệm mỗi năm. Danh hiệu **"Nông dân Việt Nam xuất sắc 40 năm Đổi mới"** và cương vị Phó Chủ tịch Thường trực Hội Làng nghề nước mắm Nam Ô là phần thưởng xứng đáng cho người con nặng lòng với di sản quê hương.`,
      },
      {
        title: "Bí quyết chọn cá cơm than tháng Ba và muối Sa Huỳnh ủ kho 1 năm: Tinh hoa trong từng giọt mắm nhĩ",
        slug: "bi-quyet-chon-ca-com-than-thang-ba-va-muoi-sa-huynh",
        categoryId: cultureCatId,
        excerpt: "Không phải loại cá nào cũng làm được nước mắm Nam Ô hảo hạng. Khám phá bí quyết chọn cá cơm than béo tròn tháng Ba âm lịch và kỹ thuật trữ muối Sa Huỳnh trên 1 năm để lọc bỏ vị chát đắng tự nhiên.",
        thumbnailUrl: "/images/hero-banner.jpg",
        content: `Trong nghề làm mắm thủ công truyền thống tại Nam Ô, người nghệ nhân có câu: "Nhất cá, nhì muối, tam lu sành". Thiếu một trong ba yếu tố ấy, nước mắm chắt ra không bao giờ đạt được độ thơm ngọt hậu và sắc màu hổ phách đặc trưng.

### Cá cơm than tháng Ba âm lịch: Tinh túy biển khơi Nam Ô
Vùng biển vịnh Đà Nẵng dưới chân đèo Hải Vân quanh năm sóng êm, nước sâu và có độ mặn lý tưởng, là nơi sinh sống của loài **cá cơm than** mình dày, thịt chắc và béo ngậy. Nhưng không phải lúc nào cá cơm than cũng được chọn muối mắm.

Vụ cá tháng Ba âm lịch là thời điểm "vàng". Lúc này cá cơm than đã qua mùa sinh sản, thân cá tròn lẳn, vảy ánh đen bóng mỡ màng, ruột sạch và đạt hàm lượng đạm tự nhiên cao nhất. Thuyền đánh cá cập bờ lúc rạng sáng, từng rổ cá tươi roi rói được vận chuyển ngay về xưởng Hương Làng Cổ mà không qua ướp đá công nghiệp hay bảo quản lạnh, giữ trọn độ tươi sống nguyên bản.

### Muối Sa Huỳnh hạt to: Phải ủ kho trên 1 năm
Người làm mắm Nam Ô vô cùng khắt khe với hạt muối. Muối dùng để muối cá là loại muối hạt to, trắng trong từ đồng muối nổi tiếng Sa Huỳnh (Quảng Ngãi) hoặc Cà Ná.

Đặc biệt, **muối mới thu hoạch tuyệt đối không được đem muối cá ngay**. Khi mới cào từ đồng ruộng, muối còn chứa nhiều tạp chất như magie, canxi, kali khiến mắm có vị chát đắng và chua. Nghệ nhân Hương Làng Cổ phải lưu trữ muối trong kho râm mát có sàn thoát nước từ **12 đến 18 tháng**. Qua thời gian dài, nước ót chát đắng tự nhiên sẽ rỉ hết xuống dưới, hạt muối khô ráo, trắng tinh khiết và có vị mặn dịu ngọt thanh.

### Lu sành đất nung và tỷ lệ vàng 3 cá : 1 muối
Cá và muối được trộn đều theo tỷ lệ vàng **3 cá : 1 muối**, sau đó đưa vào các lu sành làm từ đất nung truyền thống. Lu sành có đặc tính giữ nhiệt độ ổn định trước sự thay đổi ngày đêm của thời tiết, tạo môi trường tối ưu cho các enzym tự nhiên trong ruột cá phân giải protein thành các acid amin quý giá.

Trải qua 12 đến 18 tháng ủ kín, được người thợ chăm chút đảo chượp bằng phễu tre truyền thống, giọt nước mắm nhĩ đầu tiên chắt ra trong vắt, sánh đặc như mật ong, thơm nồng đượm và đọng lại vị ngọt sâu bùi ngậy nơi cổ họng.`,
      },
      {
        title: "Trải nghiệm du lịch làng nghề: Một ngày làm nghệ nhân tại xưởng mắm Hương Làng Cổ",
        slug: "trai-nghiem-du-lich-lang-nghe-mot-ngay-tai-xuong-huong-lang-co",
        categoryId: heritageCatId,
        excerpt: "Cơ sở Hương Làng Cổ tại Nam Ô không chỉ là xưởng sản xuất mà còn là điểm đến du lịch trải nghiệm văn hóa sống động, đón hàng ngàn lượt du khách trong nước, quốc tế và học sinh sinh viên đến khám phá nét đẹp di sản.",
        thumbnailUrl: "/images/hero-banner.jpg",
        content: `Rời xa nhịp sống ồn ào của phố thị Đà Nẵng, men theo đường Nguyễn Lương Bằng về hướng chân đèo Hải Vân, rẽ vào Kiệt 884, bạn sẽ bước vào không gian thanh bình của làng chài cổ Nam Ô 2. Nơi đây, cơ sở Nước mắm Nam Ô — Hương Làng Cổ luôn mở rộng cửa đón chào những tâm hồn yêu mến văn hóa truyền thống.

### Lạc bước giữa "rừng" lu sành cổ kính
Ấn tượng đầu tiên khi đặt chân đến xưởng là hình ảnh hàng trăm chiếc lu sành đất nung mộc mạc được xếp ngay ngắn thành từng hàng dài dưới mái hiên thoáng đãng. Không khí thoang thoảng mùi thơm nồng đượm, mặn mòi rất đỗi thân quen của cá và muối đang lên men tự nhiên.

Tại đây, du khách được trực tiếp nghe anh Bùi Thanh Phú và các nghệ nhân lớn tuổi kể về lịch sử hơn 4 thế kỷ của làng nghề Nam Ô — nơi từng được mệnh danh là vùng đất "tiến vua" với những mẻ mắm ngon bậc nhất xứ Đàng Trong.

### Tự tay trải nghiệm các công đoạn làm mắm
Không chỉ tham quan ngắm nhìn, du khách còn được trực tiếp trải nghiệm:
* Học cách phân biệt cá cơm than béo mẫm tháng Ba và kiểm tra hạt muối Sa Huỳnh đã qua ủ kho.
* Tham gia công đoạn trộn cá muối theo tỷ lệ truyền thống.
* Trực tiếp kéo rút, ngắm từng giọt nước mắm nhĩ màu hổ phách nhỏ giọt từ từ qua chiếc phễu tre đan tay lót vải mịn.
* Thưởng thức giọt mắm nhĩ tươi mới nguyên chất ngay tại phễu — cảm nhận vị mặn đậm đà tan nhanh nơi đầu lưỡi và hậu vị ngọt sâu khó tả kéo dài nơi cuống họng.

### Kết nối di sản và du lịch cộng đồng
Mô hình du lịch trải nghiệm tại xưởng Hương Làng Cổ không chỉ giúp du khách hiểu sâu sắc hơn về giá trị giọt nước mắm truyền thống, mà còn tạo thêm việc làm, khơi dậy niềm tự hào cho bà con ngư dân Nam Ô cùng chung tay gìn giữ Di sản văn hóa phi vật thể Quốc gia.`,
      },
      {
        title: "Giải mã hiện tượng nước mắm truyền thống xuống màu sẫm lại sau khi mở nắp: Dấu hiệu của sự nguyên chất",
        slug: "hien-tuong-nuoc-mam-truyen-thong-xuong-mau-dau-hieu-nguyen-chat",
        categoryId: cultureCatId,
        excerpt: "Nhiều khách hàng thắc mắc khi thấy chai nước mắm truyền thống chuyển màu sẫm hơn sau một thời gian mở nắp. Đây là phản ứng tự nhiên của đạm cá nguyên chất không phụ gia bảo quản, là bảo chứng cho chất lượng thật.",
        thumbnailUrl: "/images/hero-banner.jpg",
        content: `Nhiều khách hàng khi mua Nước mắm Nam Ô — Hương Làng Cổ về sử dụng thường có chung một thắc mắc: *"Tại sao khi mới mở nắp chai, nước mắm có màu đỏ nâu cánh gián hổ phách trong veo, nhưng sau một thời gian sử dụng thì màu mắm lại sẫm đen hơn ban đầu? Liệu mắm có bị hỏng hay kém chất lượng không?"*

Câu trả lời từ các chuyên gia ẩm thực và nghệ nhân làng nghề Nam Ô là: **Hiện tượng xuống màu sẫm lại chính là bảo chứng vững chắc nhất cho một chai nước mắm truyền thống 100% nguyên chất, không hóa chất bảo quản!**

### Cơ chế khoa học: Phản ứng oxy hóa của đạm acid amin tự nhiên
Nước mắm truyền thống Nam Ô được ủ chượp hoàn toàn tự nhiên từ cá cơm than tươi và muối biển. Trong quá trình lên men kéo dài 12-18 tháng, protein trong thịt cá được phân giải triệt để thành hàng triệu phân tử acid amin và đạm tự nhiên có lợi cho sức khỏe.

Khi mở nắp chai sử dụng, nước mắm tiếp xúc với oxy trong không khí. Các acid amin tự nhiên gặp oxy sẽ xảy ra hiện tượng oxy hóa tự nhiên, làm sắc tố melanin trong mắm đậm màu hơn. Hiện tượng này hoàn toàn giống như việc bạn gọt một quả táo hay quả chuối, để ngoài không khí một lúc bề mặt sẽ bị thâm lại do enzyme và chất dinh dưỡng tự nhiên tiếp xúc với oxy.

### Vì sao nước mắm công nghiệp không bao giờ đổi màu?
Ngược lại, nước mắm công nghiệp hoặc nước chấm pha loãng thường sử dụng chất chống oxy hóa nhân tạo (như sulfite), chất bảo quản và phẩm màu hóa học. Do hàm lượng đạm cá thật rất thấp hoặc sử dụng chất ngăn chặn oxy hóa, nước mắm công nghiệp dù mở nắp cả năm vẫn giữ nguyên màu sắc ban đầu.

### Mẹo sử dụng và bảo quản nước mắm Nam Ô ngon nhất
* **Đậy kín nắp chai sau mỗi lần sử dụng:** Giúp hạn chế tối đa sự tiếp xúc giữa mắm và không khí, giữ trọn hương thơm nồng nàn.
* **Bảo quản nơi thoáng mát:** Tránh ánh nắng mặt trời trực tiếp và nơi có nhiệt độ quá cao.
* **TUYỆT ĐỐI KHÔNG ĐỂ TRONG TỦ LẠNH:** Nước mắm truyền thống có độ mặn tự nhiên đã là chất bảo quản sinh học hoàn hảo. Nếu cất trong tủ lạnh, nhiệt độ thấp sẽ khiến muối tự nhiên kết tinh đọng dưới đáy chai và làm giảm độ đạm trong nước mắm.`,
      },
      {
        title: "Nước mắm Nam Ô trong mâm cơm xứ Quảng: Linh hồn của món gỏi cá Nam Ô và bánh tráng cuốn thịt heo",
        slug: "nuoc-mam-nam-o-trong-mam-com-xu-quang-linh-hon-am-thuc",
        categoryId: cultureCatId,
        excerpt: "Nước mắm Nam Ô không đơn thuần là gia vị, mà là linh hồn kết nối hương vị các món đặc sản trứ danh Đà Nẵng — Quảng Nam như gỏi cá Nam Ô và bánh tráng cuốn thịt heo hai đầu da.",
        thumbnailUrl: "/images/hero-banner.jpg",
        content: `Người miền Trung đi xa, thứ da diết nhất gợi nhắc quê nhà thường gói gọn trong một chén nước mắm dầm ớt xiêm xanh cay xè trên mâm cơm gia đình. Và với người xứ Quảng, nếu bữa ăn thiếu đi giọt nước mắm Nam Ô đậm đà thì dường như hương vị ẩm thực đã vơi đi một nửa.

### Linh hồn của món Gỏi cá Nam Ô trứ danh
Nhắc đến đặc sản Đà Nẵng, không thể không kể đến **Gỏi cá Nam Ô** — món ăn dân dã mà tinh tế nức tiếng gần xa. Cá dùng làm gỏi là cá trích tươi vừa được kéo lưới vào bờ lúc sáng sớm, thịt cá trắng ngần, ngọt lịm.

Nhưng điều làm nên sự thăng hoa cho món gỏi cá chính là bát nước chấm gia truyền. Nước mắm nhĩ Nam Ô Hương Làng Cổ được đun sôi nhẹ cùng một chút gừng giã nhuyễn, ớt chỉ thiên cay nồng, tỏi Lý Sơn, thêm đậu phộng rang giã mịn và chút thính ngô thơm lừng. Gắp một miếng cá cuộn cùng đọt xoài non, lá lộc vừng, chuối chát rồi chấm ngập vào chén nước mắm Nam Ô, vị ngọt của cá tươi, cay của ớt, bùi của đậu phộng và vị mặn đậm đà của mắm hòa quyện tạo nên một trải nghiệm vị giác bùng nổ.

### Bánh tráng cuốn thịt heo hai đầu da và bát mắm chấm đậm vị
Cùng với gỏi cá, món **bánh tráng cuốn thịt heo** Đà Nẵng cũng không thể thiếu chén nước mắm nhĩ hoặc mắm nêm nguyên chất Nam Ô. Đĩa thịt heo luộc thái mỏng khéo léo để hai đầu đều có da, ăn kèm xà lách, tía tô, giá đỗ, dưa leo và chuối xanh. Cuộn tròn miếng bánh tráng phơi sương, chấm vào bát mắm nhĩ nguyên chất sóng sánh thơm lừng, thực khách sẽ hiểu vì sao món ăn này lại có sức quyến rũ mê hoặc đến thế.

### Sự mộc mạc và nghĩa tình trong giọt mắm quê
Bát nước mắm đặt chính giữa mâm cơm gia đình người Việt từ bao đời nay là biểu tượng của sự sẻ chia, gắn kết tình thân. Giọt nước mắm Nam Ô Hương Làng Cổ được chắt chiu bằng cả mồ hôi, tâm huyết của những ngư dân vùng biển chân đèo Hải Vân, mang theo cả phong vị nắng gió miền Trung gửi gắm vào từng bữa cơm đầm ấm của mỗi gia đình Việt Nam.`,
      },
      {
        title: "Nước mắm Nam Ô Hương Làng Cổ đạt chuẩn OCOP 4 sao và HACCP: Khẳng định chất lượng đỉnh cao",
        slug: "nuoc-mam-nam-o-huong-lang-co-dat-chuan-ocop-4-sao-haccp",
        categoryId: cultureCatId,
        excerpt: "Không chỉ giữ trọn vị mắm xưa, Nước mắm Nam Ô Hương Làng Cổ đã được UBND TP Đà Nẵng chứng nhận đạt chuẩn OCOP 4 sao và chứng nhận quốc tế HACCP, đảm bảo an toàn tuyệt đối cho bữa ăn gia đình.",
        thumbnailUrl: "/images/hero-banner.jpg",
        content: `Trong chương trình "Mỗi xã một sản phẩm" (OCOP), sản phẩm Nước mắm Nam Ô Hương Làng Cổ đã xuất sắc vượt qua các tiêu chí kiểm định nghiêm ngặt để được UBND Thành phố Đà Nẵng công nhận đạt chuẩn **OCOP 4 sao**.

### Chuẩn hóa chất lượng với chứng nhận HACCP
Không dừng lại ở kinh nghiệm dân gian, cơ sở sản xuất Hương Làng Cổ đã áp dụng thành công hệ thống quản lý an toàn thực phẩm theo tiêu chuẩn quốc tế **HACCP**. Mọi công đoạn từ khâu tiếp nhận nguyên liệu cá cơm, muối hạt, quá trình lên men tự nhiên đến khâu chiết rót, đóng chai đều được giám sát vệ sinh nghiêm ngặt.

### Cách nhận biết nước mắm truyền thống nguyên chất
* **Màu sắc:** Nước mắm thật có màu nâu cánh gián hổ phách trong trẻo. Sau khi mở nắp tiếp xúc với không khí, màu sắc mắm có thể sẫm lại đôi chút — đây là hiện tượng tự nhiên do đạm cá nguyên chất bị oxy hóa, hoàn toàn an tâm sử dụng.
* **Mùi hương:** Mùi thơm dịu, bùi béo tự nhiên của cá chín muồi, không có mùi gắt của hóa chất tạo mùi.
* **Vị giác:** Ban đầu cảm nhận vị mặn đậm đà nơi đầu lưỡi, nhưng ngay sau đó là hậu vị ngọt đượm kéo dài nơi cổ họng.

Nước mắm Nam Ô Hương Làng Cổ không chỉ là gia vị cho bữa cơm sum vầy, mà còn là món quà ý nghĩa gửi gắm trọn vẹn tình cảm và tinh hoa văn hóa đất Đà Thành.`,
      },
    ];

    for (const post of postsData) {
      await connection.execute(`
        INSERT INTO blog_posts (category_id, title, slug, excerpt, content, thumbnail_url, status, published_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PUBLISHED', NOW())
        ON DUPLICATE KEY UPDATE
          category_id = VALUES(category_id),
          title = VALUES(title),
          excerpt = VALUES(excerpt),
          content = VALUES(content),
          thumbnail_url = VALUES(thumbnail_url),
          status = 'PUBLISHED',
          published_at = NOW()
      `, [post.categoryId, post.title, post.slug, post.excerpt, post.content, post.thumbnailUrl]);
    }

    console.info("7. Cập nhật banner trang chủ (banners)...");
    await connection.execute(`
      INSERT INTO banners (title, image_url, link_url, sort_order, is_active, start_at, end_at)
      VALUES (
        'Nước mắm Nam Ô Hương Làng Cổ - Tinh hoa ẩm thực Việt',
        '/images/hero-banner.jpg',
        '/san-pham',
        1,
        1,
        NOW(),
        DATE_ADD(NOW(), INTERVAL 5 YEAR)
      )
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        image_url = VALUES(image_url),
        link_url = VALUES(link_url),
        is_active = 1
    `);

    await connection.commit();
    console.info("=> NẠP DỮ LIỆU THỰC TẾ XÁC THỰC THÀNH CÔNG!");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

seedVerifiedData().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Seed verified data failed";
  console.error("Lỗi:", message);
  process.exitCode = 1;
});
