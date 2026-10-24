USE nam_o_fish_sauce;

CREATE TABLE IF NOT EXISTS store_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    store_name VARCHAR(150) NOT NULL,
    store_description VARCHAR(500) NULL,
    logo_url VARCHAR(2048) NULL,
    store_address VARCHAR(500) NULL,
    contact_phone VARCHAR(32) NULL,
    contact_email VARCHAR(254) NULL,
    shipping_fee DECIMAL(12, 2) NULL,
    free_shipping_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    free_shipping_minimum DECIMAL(12, 2) NULL,
    customer_cancellation_statuses JSON NOT NULL,
    cod_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    bank_transfer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    bank_name VARCHAR(100) NULL,
    bank_account_number VARCHAR(50) NULL,
    bank_account_holder VARCHAR(150) NULL,
    bank_branch VARCHAR(150) NULL,
    facebook_url VARCHAR(2048) NULL,
    tiktok_url VARCHAR(2048) NULL,
    youtube_url VARCHAR(2048) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO store_settings (id, store_name, customer_cancellation_statuses)
VALUES (1, 'Nước mắm Nam Ô Hương Làng Cổ', JSON_ARRAY('PENDING', 'CONFIRMED'))
ON DUPLICATE KEY UPDATE id = VALUES(id);
