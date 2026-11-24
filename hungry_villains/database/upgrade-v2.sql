-- Apply once to the existing Hungry Villains database, with that database selected.
CREATE TABLE IF NOT EXISTS pos_settings (
    setting_key VARCHAR(40) PRIMARY KEY,
    setting_value VARCHAR(128) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_sales (
    sale_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    request_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    order_id INT UNIQUE,
    cashier_name VARCHAR(50) NOT NULL,
    subtotal_cents BIGINT UNSIGNED NOT NULL,
    discount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
    discount_reason VARCHAR(120) NOT NULL DEFAULT '',
    captured_offline TINYINT(1) NOT NULL,
    synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_payments (
    order_id INT PRIMARY KEY,
    method ENUM('cash','ewallet','card') NOT NULL,
    tendered_cents BIGINT UNSIGNED NOT NULL,
    change_cents BIGINT UNSIGNED NOT NULL,
    payment_reference VARCHAR(80) NOT NULL DEFAULT '',
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_stock_movements (
    movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    order_id INT NULL,
    actor_id INT NOT NULL,
    quantity_delta INT NOT NULL,
    balance_after INT NOT NULL,
    reason VARCHAR(40) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (product_id, created_at),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_audit_log (
    event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    entity_id INT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_login_limits (
    attempt_key CHAR(64) CHARACTER SET ascii PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL,
    window_end BIGINT UNSIGNED NOT NULL,
    INDEX (window_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
