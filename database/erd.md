# ERD — `nam_o_fish_sauce`

The diagram lists primary keys (`PK`) and foreign keys (`FK`). Unique constraints and secondary indexes are documented in [README.md](./README.md) and declared in `schema.sql`.

```mermaid
erDiagram
    users {
        BIGINT id PK
        VARCHAR email UK
        VARCHAR phone UK
        VARCHAR password_hash
        VARCHAR role
        VARCHAR status
    }
    categories {
        BIGINT id PK
        VARCHAR slug UK
        VARCHAR status
    }
    products {
        BIGINT id PK
        BIGINT category_id FK
        VARCHAR slug UK
        VARCHAR status
    }
    product_variants {
        BIGINT id PK
        BIGINT product_id FK
        VARCHAR sku UK
        DECIMAL price
    }
    product_images {
        BIGINT id PK
        BIGINT product_id FK
        VARCHAR image_url
        BOOLEAN is_primary
    }
    inventory {
        BIGINT id PK
        BIGINT variant_id FK_UK
        INT quantity
        INT reserved_quantity
    }
    carts {
        BIGINT id PK
        BIGINT user_id FK
        CHAR guest_token_hash
        VARCHAR status
    }
    cart_items {
        BIGINT id PK
        BIGINT cart_id FK
        BIGINT variant_id FK
        INT quantity
    }
    shipping_addresses {
        BIGINT id PK
        BIGINT user_id FK
        VARCHAR recipient_name
        VARCHAR address_line
    }
    coupons {
        BIGINT id PK
        VARCHAR code UK
        VARCHAR discount_type
        DECIMAL discount_value
    }
    orders {
        BIGINT id PK
        BIGINT user_id FK
        BIGINT coupon_id FK
        VARCHAR order_code UK
        DECIMAL total_amount
        VARCHAR customer_name
        VARCHAR shipping_address_line
    }
    order_items {
        BIGINT id PK
        BIGINT order_id FK
        BIGINT product_id FK
        BIGINT variant_id FK
        VARCHAR product_name
        VARCHAR variant_name
        VARCHAR sku
        DECIMAL unit_price
        INT quantity
    }
    payments {
        BIGINT id PK
        BIGINT order_id FK
        VARCHAR payment_method
        VARCHAR payment_status
        DECIMAL amount
    }
    reviews {
        BIGINT id PK
        BIGINT product_id FK
        BIGINT user_id FK
        TINYINT rating
    }
    coupon_usages {
        BIGINT id PK
        BIGINT coupon_id FK
        BIGINT user_id FK
        BIGINT order_id FK_UK
    }
    videos {
        BIGINT id PK
        VARCHAR platform
        VARCHAR video_url
    }
    social_links {
        BIGINT id PK
        VARCHAR platform UK
        VARCHAR url
    }
    banners {
        BIGINT id PK
        VARCHAR image_url
        DATETIME start_at
        DATETIME end_at
    }
    blog_categories {
        BIGINT id PK
        VARCHAR slug UK
    }
    blog_posts {
        BIGINT id PK
        BIGINT category_id FK
        VARCHAR slug UK
        VARCHAR status
    }

    categories ||--o{ products : categorizes
    products ||--o{ product_variants : offers
    products ||--o{ product_images : displays
    product_variants ||--o| inventory : stocks
    users o|--o{ carts : owns
    carts ||--o{ cart_items : contains
    product_variants ||--o{ cart_items : selected
    users ||--o{ shipping_addresses : saves
    users o|--o{ orders : places
    coupons o|--o{ orders : discounts
    orders ||--o{ order_items : snapshots
    products o|--o{ order_items : referenced_by
    product_variants o|--o{ order_items : referenced_by
    orders ||--o{ payments : paid_by
    products ||--o{ reviews : receives
    users o|--o{ reviews : writes
    coupons ||--o{ coupon_usages : tracks
    users o|--o{ coupon_usages : redeems
    orders ||--o| coupon_usages : applies
    blog_categories o|--o{ blog_posts : groups
```

Orders store shipping/customer snapshots directly and are intentionally not linked to the user's editable saved address. The optional product and variant references on order lines do not replace their required name, SKU, and price snapshots.
