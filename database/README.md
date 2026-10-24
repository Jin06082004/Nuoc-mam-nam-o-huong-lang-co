# Database

## Overview

- Database: `nam_o_fish_sauce`
- Engine: MySQL 8.0.16 or newer (InnoDB)
- Character set/collation: `utf8mb4` / `utf8mb4_unicode_ci`
- Schema uses `snake_case`, unsigned `BIGINT` primary keys, and `DECIMAL` for currency.

MySQL 8.0.16+ is recommended because earlier MySQL 8.0 releases parsed but did not enforce `CHECK` constraints.

## Create and load the database

The schema is intended for a new database and uses `CREATE TABLE IF NOT EXISTS`. Run these scripts in order:

1. Open `schema.sql` in MySQL Workbench and execute it. It creates and selects `nam_o_fish_sauce`.
2. Open `seed.sql` and execute it after the schema.
3. Refresh the Schemas panel and inspect the created tables.

The same scripts can be run from a MySQL command-line client in Command Prompt or a POSIX shell (replace `your_mysql_user` with your MySQL account):

```text
mysql -u your_mysql_user -p < database/schema.sql
mysql -u your_mysql_user -p nam_o_fish_sauce < database/seed.sql
```

Do not put passwords in these scripts or commit credentials. The seed script is idempotent and inserts only the Facebook URL supplied by the owner. It intentionally creates no products, prices, variants, images, videos, TikTok link, or YouTube link.

## Tables

| Group | Tables |
|---|---|
| Accounts | `users`, `shipping_addresses` |
| Catalog | `categories`, `products`, `product_variants`, `product_images`, `inventory` |
| Shopping | `carts`, `cart_items` |
| Orders | `orders`, `order_items`, `payments` |
| Reviews and promotions | `reviews`, `coupons`, `coupon_usages` |
| Content | `videos`, `social_links`, `banners`, `blog_categories`, `blog_posts` |

## Main relationships

- A category has many products; a product has many variants and images.
- Each variant has at most one inventory row.
- A user or guest-token hash owns a cart; a cart has items, each referencing a product variant.
- A user has saved shipping addresses. Orders independently store shipping/customer snapshots; they do not depend on a mutable saved address.
- An order has line-item snapshots and payments. Its optional user and coupon references do not replace the order's saved customer, shipping, price, or coupon-code data.
- Reviews reference products and optionally users. Coupon usage references a coupon and order, and optionally a user.
- Blog posts optionally reference a blog category.
- Videos, social links, and banners are standalone content records.

See [erd.md](./erd.md) for the complete PK/FK relationship map.

## Data and integrity rules

- Passwords belong in `users.password_hash`; the database never stores plaintext passwords.
- Product image and banner fields store URLs/paths, not image bytes. Binary assets belong in file/object storage.
- Product variants hold SKU, price, and optional volume/unit. No official product or variant data is seeded.
- `inventory` is tracked per variant and prevents reserved quantity exceeding quantity.
- Unique constraints protect emails/phones when supplied, slugs, SKUs, order codes, coupon codes, cart item pairs, and social platform records. A generated-column unique index permits at most one primary image per product and one active cart per account/guest token.
- Orders store customer/shipping details and each order item stores product/variant/SKU/price snapshots. Preserve order history; archive records through status rather than deleting them.
- `orders.total_amount` must equal `subtotal + shipping_fee - discount_amount`. The application must calculate these values transactionally from trusted database prices and validate aggregate line totals.
- `CHECK` constraints validate role/status values, nonnegative money, positive quantities, review rating range, coupon percentage range, and date ranges.
- Foreign keys use `RESTRICT` for historical/order-sensitive data, `SET NULL` where an optional relationship should not erase a record, and `CASCADE` only for dependent product images and cart lines.
- Avoid hard-deleting users, products, categories, coupons, or orders that have historical references; transition them to an inactive/archived state instead.

## Index notes

Indexes are aligned to common lookups: unique identity/URL codes (`email`, `phone`, `slug`, `sku`, `order_code`, coupon `code`); product/category and variant relations; status plus sort/date fields for catalog/content/admin lists; user and creation time for order history; and relationship columns used by joins. MySQL also requires indexes for foreign-key columns; explicit indexes are included where they do not already lead a unique/composite index.

## MySQL Workbench and ERD

To reverse engineer an ERD, connect to the MySQL instance, choose **Database → Reverse Engineer**, select `nam_o_fish_sauce`, and import the schema. The schema defines foreign keys directly, so Workbench can infer the relationships. The Mermaid diagram in [erd.md](./erd.md) is a readable source-controlled overview.

## Updating the schema

`schema.sql` is a bootstrap schema, not a versioned migration system. For an already-used database, do not rerun schema changes as an implicit migration: create a reviewed, forward-only migration script, back up data, and test against a copy first. Keep schema and migration changes synchronized.
