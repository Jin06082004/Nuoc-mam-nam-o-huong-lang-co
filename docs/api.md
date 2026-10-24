# REST API

Base path: `/api`. Responses use `{ "success": true, "data": ... }`; paginated responses also include `{ "meta": { "page", "limit", "total" } }`. Errors use `{ "success": false, "message": "...", "errors": [] }`.

## Authentication and access

Authentication uses an `HttpOnly` `access_token` cookie (one-hour JWT). Send requests with credentials enabled. Production cookies are `Secure`; CORS permits only `FRONTEND_URL`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Register customer (`full_name`, `email`, optional `phone`, `password`) |
| POST | `/auth/login` | Public | Login (`identifier` email or phone, `password`) |
| POST | `/auth/logout` | Public | Clear auth cookie |
| GET | `/auth/me` | Authenticated | Current account |
| GET | `/health` | Public | API/database health, no secrets |

Passwords are hashed with bcrypt. Registration/login are rate limited. Admin routes enforce the current active database user role; frontend checks are not authorization.

Registration always creates a `CUSTOMER`. No default administrator or password is seeded. For local development, `server/src/scripts/seed-admin.ts` can create an admin using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment; it hashes passwords with bcrypt, preserves an existing password, and refuses to run when `NODE_ENV=production`. Run it from `server` with `npm run seed:admin`. Do not add a public admin-setup endpoint.

## Catalog

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/categories` | Public | Active categories; paginated |
| GET | `/products` | Public | `page`, `limit` (max 100), `search`, `category` slug, `sort` (`newest`, `name_asc`, `price_asc`, `price_desc`) |
| GET | `/products/:productId` | Public | Active product, variants, images, rating summary |
| GET | `/products/:productId/related` | Public | Up to eight active related products |
| GET | `/products/:productId/reviews` | Public | Approved reviews, paginated |
| POST | `/products/:productId/reviews` | Customer | Submit rating 1–5 and optional comment; moderation starts at `PENDING` |
| PUT | `/reviews/:id` | Review owner | Edit review, resets moderation to pending |
| DELETE | `/reviews/:id` | Review owner | Delete own review |

Public product responses do not expose exact inventory counts. Product search and sort values are parameterized/whitelisted. List endpoints accept `page` and `limit` (maximum 100) and include pagination metadata.

Reviews are moderated, but verified-purchase status is not claimed or enforced: the Phase 1 `reviews` table does not include an order reference.

## Cart and orders

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/cart` | Customer | Active customer's cart |
| POST | `/cart/items` | Customer | `{ "variant_id": 1, "quantity": 2 }`; repeated variants increase quantity |
| PUT | `/cart/items/:id` | Customer | `{ "quantity": 2 }`; checks availability |
| DELETE | `/cart/items/:id` | Customer | Remove own cart item |
| DELETE | `/cart` | Customer | Empty own cart |
| POST | `/cart/clear` | Customer | Empty own cart; JSON response |
| POST | `/orders` | Customer | Checkout from database cart/prices; snapshots order/address/item data, locks and decrements inventory, creates pending payment, and converts cart in one transaction |
| GET | `/orders` | Customer | Own orders only; paginated |
| GET | `/orders/:id` | Owner | Order/item/payment snapshots; other users' orders appear not found |
| PATCH | `/orders/:id/cancel` | Owner | Cancel only when the database setting allows the current status; restores stock |
| GET | `/orders/:id/payment` | Owner | Payment method/status/amount |
| POST | `/coupons/validate` | Customer | `{ "code": "...", "subtotal": 100 }` preview only; checkout revalidates against the database cart |

Checkout request requires `payment_method` (`COD` or `BANK_TRANSFER`), `customer_name`, `customer_phone`, `shipping_address_line`, and `shipping_province`; ward, district, note, and coupon code are optional. Client-supplied unit prices/totals are ignored. Shipping fees, free-shipping thresholds, enabled payment methods, and customer cancellation statuses are read from database settings. `SHIPPING_FEE` is an optional legacy fallback only when the database fee is unset. Checkout is rejected until an effective fee is configured and when the chosen payment method is disabled. Payment remains `PENDING`; no gateway or payment success is simulated. New orders always start at `PENDING`; this invariant is not exposed as a mutable setting.

## Store settings

Apply `database/migrations/001_store_settings.sql` after the base schema to create the singleton `store_settings` row. The migration initializes the known store name, current customer-cancellation states (`PENDING`, `CONFIRMED`), COD availability, and empty nullable business contact, logo, bank, social, and shipping fields. It does not copy sample social links or invent contact/bank data. The migration is idempotent.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/settings` | Public | Store name/description/logo, contact, shipping policy, enabled payment methods, display-only bank details when transfers are enabled, and configured social URLs |
| GET | `/admin/settings` | ADMIN | Read the complete editable settings record, including cancellation statuses and bank details |
| PUT | `/admin/settings` | ADMIN | Validate and replace the editable settings record |

The settings API rejects unknown properties (including password/API-key-like fields), unsafe URL schemes, negative amounts, invalid email/phone values, invalid cancellation statuses, incomplete free-shipping rules, and enabling bank transfer without bank name/account number/account holder. Bank details are display-only account information; credentials, PINs, passwords, CVV, and API keys are not stored. Public settings omit cancellation policy details and suppress bank account fields while bank transfer is disabled. Blank optional contact, URL, and bank fields are stored as SQL `NULL`.

Customer cancellation remains limited to the existing transition states and is further restricted by `customer_cancellation_statuses`. Optional order item-count bounds are not stored because the current checkout has no such business rule. Run the migration before serving customer/admin settings routes; a missing settings row returns an explicit service error rather than fabricated defaults.

## Administration

All admin endpoints below require an authenticated `ADMIN` account. List endpoints accept `page` and `limit` (maximum 100) and return pagination metadata.

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/admin/categories` | List/create categories |
| PUT/DELETE | `/admin/categories/:id` | Update/archive category |
| GET/POST | `/admin/products` | Paginated list/create product |
| PUT/DELETE | `/admin/products/:id` | Update/archive product |
| POST | `/admin/products/:productId/variants` | Create variant and zero-stock inventory record |
| PUT/DELETE | `/admin/variants/:id` | Update/deactivate variant |
| POST | `/admin/products/:productId/images` | Add image URL/path |
| PUT | `/admin/product-images/:id` | Update image metadata/primary status |
| PATCH | `/admin/product-images/:id/primary` | Set primary image |
| DELETE | `/admin/product-images/:id` | Remove image |
| GET | `/admin/inventory` | Paginated inventory |
| PATCH | `/admin/inventory/:variantId` | Set stock without going below reserved stock |
| GET | `/admin/dashboard/stats` | Database-backed order, revenue, product, customer, low-stock, recent-order, and recent-review statistics |
| GET | `/admin/orders` | Paginated all orders |
| GET | `/admin/orders/:id` | Order detail |
| PATCH | `/admin/orders/:id/status` | Transition order status using allowed state transitions |
| GET | `/admin/users` | Paginated users without password hashes |
| GET | `/admin/users/:id` | Safe customer profile with up to ten recent orders and reviews |
| PATCH | `/admin/users/:id` | Update role/status; prevents self-lockout for current admin |
| GET | `/admin/products/:id` | Product detail including inactive variants and inventory, for administration/editing |
| GET | `/admin/reviews` | Paginated reviews, optional `status` filter |
| PATCH | `/admin/reviews/:id/status` | Moderate review (`PENDING`, `APPROVED`, `REJECTED`, `HIDDEN`) |
| GET/POST | `/admin/coupons` | List/create coupon |
| PUT/DELETE | `/admin/coupons/:id` | Update/deactivate coupon |
| GET/POST | `/admin/videos` | List/create YouTube content |
| PUT/DELETE | `/admin/videos/:id` | Update/deactivate video |
| PATCH | `/admin/videos/:id/status` | Activate/deactivate video |
| GET/POST | `/admin/social-links` | List/create social links |
| PUT/DELETE | `/admin/social-links/:id` | Update/deactivate social link |
| PATCH | `/admin/social-links/:id/status` | Activate/deactivate link |
| GET/POST | `/admin/banners` | List/create banners |
| PUT/DELETE | `/admin/banners/:id` | Update/deactivate banner |
| GET/POST | `/admin/blog/categories` | List/create blog categories |
| PUT/DELETE | `/admin/blog/categories/:id` | Update/archive blog category |
| GET/POST | `/admin/blog/posts` | List/create blog posts |
| PUT/DELETE | `/admin/blog/posts/:id` | Update/archive blog post |

DELETE on managed catalog/content resources archives or deactivates records; order history is retained. Review/user-owned delete endpoints follow their own ownership rules.

Dashboard statistics are queried from the database and do not estimate or synthesize sales. `totalOrders` counts all orders; `pendingOrders` counts only `PENDING` orders. `revenue` sums `orders.total_amount` for every order whose status is not `CANCELLED` (including pending and returned orders), so it is order value rather than confirmed cash received. `totalProducts` counts all product records, and `totalCustomers` counts all users with role `CUSTOMER`, regardless of account/product status. `lowStockVariants` counts active variants of active products with available inventory (`quantity - reserved_quantity`) at or below the documented default threshold of 5; missing inventory rows count as zero available. The response includes `lowStockThreshold` so the configured rule is visible. Recent orders and reviews are the latest five records, ordered by creation time and ID descending. Customer detail returns the latest ten orders and reviews and uses explicit safe projections; password hashes and authentication secrets are never included.

## Errors and validation

- `401`: Missing, invalid, expired token, or inactive account.
- `403`: Authenticated user lacks the required role/ownership.
- `404`: Resource absent or not visible to this customer.
- `409`: Duplicate unique value, unavailable inventory, or invalid order transition.
- `422`: Input/business-rule validation failure.
- `500`: Unexpected server error; internal stack/SQL details are logged server-side, not returned.

Database, JWT, port, CORS, and optional legacy shipping fallback are read from `server/.env` (copy `server/.env.example` and do not commit real secrets). Start development with `npm run dev` from `server/`, build with `npm run build`, and run unit tests with `npm test`. MySQL 8.0.16+ and the Phase 1 schema plus the store-settings migration are required for runtime/API integration.
