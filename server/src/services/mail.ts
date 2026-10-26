import nodemailer from "nodemailer";
import { env } from "../config/env";

export interface OrderItemEmailDetail {
  productName: string;
  variantName: string;
  quantity: number;
  price: number | string;
  lineTotal: number | string;
}

export interface OrderEmailParams {
  orderCode: string;
  orderId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  paymentMethod: string;
  items: OrderItemEmailDetail[];
  subtotal: number | string;
  shippingFee: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  note?: string | null;
  createdAt: string;
}

function formatVnd(value: number | string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(numeric);
}

function paymentMethodLabel(method: string): string {
  switch (method) {
    case "BANK_TRANSFER":
      return "Chuyển khoản ngân hàng (VietQR / Napas 247)";
    case "PAYPAL":
      return "PayPal (Thanh toán trực tuyến Sandbox)";
    case "COD":
    default:
      return "Thanh toán khi nhận hàng (COD)";
  }
}

export function generateOrderEmailHtml(params: OrderEmailParams): string {
  const itemRows = params.items.map((item, index) => `
    <tr style="border-bottom: 1px solid #EBE4D8;">
      <td style="padding: 12px 10px; font-size: 14px; color: #28251E;">
        <strong>${item.productName}</strong><br/>
        <span style="font-size: 12px; color: #716C5F;">Quy cách: ${item.variantName}</span>
      </td>
      <td style="padding: 12px 10px; font-size: 14px; text-align: center; color: #28251E;">
        ${item.quantity}
      </td>
      <td style="padding: 12px 10px; font-size: 14px; text-align: right; color: #28251E;">
        ${formatVnd(item.price)}
      </td>
      <td style="padding: 12px 10px; font-size: 14px; text-align: right; font-weight: 600; color: #8B3A1A;">
        ${formatVnd(item.lineTotal)}
      </td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Xác nhận đơn hàng ${params.orderCode}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F4EC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #28251E;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F7F4EC; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(53, 45, 30, 0.08); border: 1px solid #E5DFD3;">
          
          <!-- Header thương hiệu -->
          <tr>
            <td style="background-color: #8B3A1A; padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; color: #FAF6F0; font-size: 22px; font-family: Georgia, serif; letter-spacing: 0.05em; text-transform: uppercase;">
                Nước Mắm Nam Ô — Hương Làng Cổ
              </h1>
              <p style="margin: 6px 0 0; color: #F0DFC8; font-size: 13px;">
                Đặc sản truyền thống tiến vua hơn 400 năm · Chuẩn OCOP 4 sao & HACCP
              </p>
            </td>
          </tr>

          <!-- Thông báo thành công -->
          <tr>
            <td style="padding: 28px 24px 20px;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #315C41;">
                ✓ Đơn hàng #${params.orderCode} đã được tiếp nhận thành công!
              </p>
              <p style="margin: 10px 0 0; font-size: 14px; line-height: 1.6; color: #4A463D;">
                Xin chào <strong>${params.customerName}</strong>, cảm ơn bạn đã tin tưởng và lựa chọn giọt nước mắm truyền thống Nam Ô được ủ chượp tự nhiên trong lu sành. Đội ngũ Hương Làng Cổ sẽ sớm kiểm tra và đóng gói đơn hàng để giao đến bạn nhanh nhất.
              </p>
            </td>
          </tr>

          <!-- Bảng sản phẩm -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #EBE4D8;">
                <thead>
                  <tr style="background-color: #FAF8F4; border-bottom: 2px solid #E0D7C7;">
                    <th style="padding: 10px; font-size: 13px; text-align: left; color: #596341;">Sản phẩm</th>
                    <th style="padding: 10px; font-size: 13px; text-align: center; color: #596341; width: 60px;">SL</th>
                    <th style="padding: 10px; font-size: 13px; text-align: right; color: #596341; width: 100px;">Đơn giá</th>
                    <th style="padding: 10px; font-size: 13px; text-align: right; color: #596341; width: 110px;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Tóm tắt thanh toán -->
          <tr>
            <td style="padding: 16px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 5px 0; font-size: 14px; color: #716C5F;">Tạm tính:</td>
                  <td style="padding: 5px 0; font-size: 14px; text-align: right; color: #28251E;">${formatVnd(params.subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-size: 14px; color: #716C5F;">Phí vận chuyển:</td>
                  <td style="padding: 5px 0; font-size: 14px; text-align: right; color: #28251E;">${formatVnd(params.shippingFee)}</td>
                </tr>
                ${Number(params.discountAmount) > 0 ? `
                <tr>
                  <td style="padding: 5px 0; font-size: 14px; color: #315C41;">Giảm giá coupon:</td>
                  <td style="padding: 5px 0; font-size: 14px; text-align: right; color: #315C41;">-${formatVnd(params.discountAmount)}</td>
                </tr>` : ""}
                <tr style="border-top: 1px dashed #D5CBB8;">
                  <td style="padding: 10px 0 5px; font-size: 16px; font-weight: 700; color: #8B3A1A;">Tổng cộng:</td>
                  <td style="padding: 10px 0 5px; font-size: 18px; font-weight: 700; text-align: right; color: #8B3A1A;">${formatVnd(params.totalAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thông tin giao hàng & Thanh toán -->
          <tr>
            <td style="padding: 10px 24px 24px;">
              <div style="background-color: #FAF8F4; border-radius: 6px; padding: 16px; border: 1px solid #ECE5D8;">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #596341;">Thông tin giao hàng:</p>
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #4A463D;">
                  <strong>Người nhận:</strong> ${params.customerName} · ${params.customerPhone}<br/>
                  <strong>Địa chỉ:</strong> ${params.shippingAddress}<br/>
                  <strong>Phương thức:</strong> ${paymentMethodLabel(params.paymentMethod)}<br/>
                  ${params.note ? `<strong>Ghi chú đơn hàng:</strong> ${params.note}<br/>` : ""}
                  <strong>Thời gian đặt:</strong> ${params.createdAt}
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer thông tin hỗ trợ -->
          <tr>
            <td style="background-color: #EFE9DC; padding: 20px 24px; text-align: center; border-top: 1px solid #E0D7C7;">
              <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #28251E;">
                CÔNG TY TNHH MẮM HỒNG HƯƠNG — HƯƠNG LÀNG CỔ
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #716C5F;">
                Địa chỉ: Tổ 97 (Nam Ô 2), Kiệt 884/74/4 Nguyễn Lương Bằng, P. Hòa Hiệp Nam, Q. Liên Chiểu, TP. Đà Nẵng<br/>
                Hotline / Zalo: <strong>0935 998 908</strong> · Email: huonglangco.namo@gmail.com<br/>
                Fanpage: <a href="https://www.facebook.com/huonglangco.vn" style="color: #8B3A1A; text-decoration: none;">facebook.com/huonglangco.vn</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendOrderConfirmationEmail(params: OrderEmailParams): Promise<boolean> {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.info(`[MAIL-DEV-MOCK] SMTP credentials unset. Mocking order confirmation email to ${params.customerEmail} (Order #${params.orderCode})`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    const html = generateOrderEmailHtml(params);

    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: params.customerEmail,
      subject: `[Hương Làng Cổ] Xác nhận đơn hàng #${params.orderCode}`,
      html,
    });

    console.info(`[MAIL] Order confirmation email sent successfully to ${params.customerEmail} (Order #${params.orderCode})`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    console.error(`[MAIL-ERROR] Failed to send email to ${params.customerEmail}:`, message);
    return false;
  }
}
