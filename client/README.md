# Client administration

The admin UI is served at `/admin` and `/admin/login`. It uses the shared API client in `src/lib/api.ts`; requests include the authentication cookie and do not read the database directly. The server remains the authorization boundary and must enforce the `ADMIN` role.

Admin pages cover products and their variants/images, product categories, inventory, orders, users/customers, reviews, coupons, banners, videos, social links, blog posts/categories, and protected store settings. Settings are saved through `/api/admin/settings`; contact, bank, and social data remain empty until provided. The public `/api/settings` response drives customer-facing store identity/contact/social displays, checkout shipping estimates, enabled payment methods, and optional bank transfer instructions. The server independently enforces configured checkout methods, fees, free-shipping thresholds, and cancellation policy.

List pages use server pagination (20 rows per request). Product search, category slug, and sort are sent only to the supported product-list API; review status is sent only to the supported review filter. Search for other lists is explicitly limited to the loaded page.

The dashboard loads real aggregates and recent records from the protected `GET /api/admin/dashboard/stats` endpoint. It does not estimate sales: the displayed revenue is non-cancelled order value, not confirmed receipts, and the low-stock threshold comes from the API response. Product and user detail pages use `GET /api/admin/products/:id` and `GET /api/admin/users/:id`.

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` from this directory.
