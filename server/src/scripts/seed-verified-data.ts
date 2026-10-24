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
        shipping_fee = 30000.00,
        free_shipping_enabled = 1,
        free_shipping_minimum = 300000.00,
        cod_enabled = 1,
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
