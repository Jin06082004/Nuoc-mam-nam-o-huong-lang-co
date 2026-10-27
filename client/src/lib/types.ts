export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page: number; limit: number; total: number };
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: Array<{ path?: string; message?: string }>;
}

export interface User {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN" | "STAFF";
}

export interface StoreSettings {
  store_name: string;
  store_description: string | null;
  logo_url: string | null;
  store_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  shipping_fee: string | number | null;
  shipping_fee_danang: string | number | null;
  free_shipping_enabled: boolean;
  free_shipping_minimum: string | number | null;
  cod_enabled: boolean;
  bank_transfer_enabled: boolean;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  bank_branch: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
}

export interface AdminStoreSettings extends StoreSettings {
  customer_cancellation_statuses: Array<"PENDING" | "CONFIRMED">;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  status: string;
  sort_order: number;
}

export interface ProductImage {
  id: number;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductVariant {
  id: number;
  sku: string;
  name: string;
  volume: number | null;
  unit: string | null;
  price: string | number;
  compare_price: string | number | null;
  in_stock?: boolean | number;
  available_quantity?: number;
  status: string;
}

export interface RatingSummary {
  average_rating: string | number | null;
  review_count: number;
}

export interface Product {
  id: number;
  category_id?: number;
  category_name?: string;
  category_slug?: string;
  name: string;
  slug: string;
  short_description: string | null;
  description?: string | null;
  status: string;
  starting_price?: string | number | null;
  primary_image?: string | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
  rating?: RatingSummary;
}

export interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface CartItem {
  id: number;
  variant_id: number;
  quantity: number;
  variant_name: string;
  sku: string;
  price: string | number;
  product_id: number;
  product_name: string;
  slug: string;
  available_quantity: number;
  line_total: string | number;
}

export interface Cart {
  id: number;
  status: string;
  items: CartItem[];
}

export interface OrderItem {
  product_name: string;
  variant_name: string;
  sku: string;
  unit_price: string | number;
  quantity: number;
  subtotal: string | number;
}

export interface Payment {
  payment_method: "COD" | "BANK_TRANSFER";
  payment_status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
  amount: string | number;
  paid_at: string | null;
}

export interface Order {
  id: number;
  order_code: string;
  status: string;
  subtotal: string | number;
  shipping_fee: string | number;
  discount_amount: string | number;
  total_amount: string | number;
  coupon_code?: string | null;
  customer_name: string;
  customer_phone: string;
  shipping_address_line: string;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_province: string;
  note?: string | null;
  created_at: string;
  can_cancel?: boolean;
  items?: OrderItem[];
  payments?: Payment[];
}

export interface Video {
  id: number;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  platform: "YOUTUBE";
}

export interface SocialLink {
  id: number;
  platform: "FACEBOOK" | "TIKTOK" | "YOUTUBE";
  name: string;
  url: string;
  icon: string | null;
}

export interface Banner {
  id: number;
  title: string;
  image_url: string;
  link_url: string | null;
}

export interface BlogPost {
  id: number;
  category_id: number | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content?: string;
  thumbnail_url: string | null;
  published_at: string | null;
}

export interface PageResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}
