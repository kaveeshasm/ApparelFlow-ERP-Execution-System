CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_role_check
        CHECK (role IN (
            'cutting_supervisor',
            'cutting_verifier',
            'sewing_supervisor'
        ))
);

CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    recipe_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    std_fabric_yards DECIMAL(10,2) NOT NULL,
    wastage_cap DECIMAL(5,2) NOT NULL,

    CONSTRAINT recipes_fabric_check
        CHECK (std_fabric_yards > 0),

    CONSTRAINT recipes_wastage_check
        CHECK (wastage_cap >= 0)
);

CREATE TABLE recipe_components (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL,
    component_name VARCHAR(150) NOT NULL,
    pieces_per_garment INTEGER NOT NULL,
    image_url TEXT,

    CONSTRAINT fk_recipe_components_recipe
        FOREIGN KEY (recipe_id)
        REFERENCES recipes(id)
        ON DELETE CASCADE,

    CONSTRAINT recipe_components_pieces_check
        CHECK (pieces_per_garment > 0)
);

CREATE TABLE cutting_orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(50) UNIQUE NOT NULL,
    recipe_id INTEGER NOT NULL,
    target_qty INTEGER NOT NULL,
    fabric_roll_id VARCHAR(100) NOT NULL,
    actual_fabric_yds DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cutting_orders_recipe
        FOREIGN KEY (recipe_id)
        REFERENCES recipes(id),

    CONSTRAINT fk_cutting_orders_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id),

    CONSTRAINT cutting_orders_quantity_check
        CHECK (target_qty > 0),

    CONSTRAINT cutting_orders_fabric_check
        CHECK (actual_fabric_yds > 0),

    CONSTRAINT cutting_orders_status_check
        CHECK (status IN (
            'CUTTING_IN_PROGRESS',
            'PENDING_VERIFICATION',
            'REJECTED',
            'VERIFIED'
        ))
);

CREATE TABLE verification_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    component_id INTEGER NOT NULL,
    expected_qty INTEGER NOT NULL,
    actual_qty INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_verification_items_order
        FOREIGN KEY (order_id)
        REFERENCES cutting_orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_verification_items_component
        FOREIGN KEY (component_id)
        REFERENCES recipe_components(id),

    CONSTRAINT verification_expected_check
        CHECK (expected_qty > 0),

    CONSTRAINT verification_actual_check
        CHECK (actual_qty >= 0),

    CONSTRAINT verification_status_check
        CHECK (status IN (
            'GREEN',
            'YELLOW',
            'RED'
        ))
);

CREATE TABLE verification_logs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    verifier_id INTEGER NOT NULL,
    decision VARCHAR(20) NOT NULL,
    rejection_note TEXT,
    wastage_pct DECIMAL(10,2) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_verification_logs_order
        FOREIGN KEY (order_id)
        REFERENCES cutting_orders(id),

    CONSTRAINT fk_verification_logs_verifier
        FOREIGN KEY (verifier_id)
        REFERENCES users(id),

    CONSTRAINT verification_decision_check
        CHECK (decision IN (
            'APPROVED',
            'REJECTED'
        )),

    CONSTRAINT verification_wastage_check
        CHECK (wastage_pct >= 0),

    CONSTRAINT rejection_reason_check
        CHECK (
            decision = 'APPROVED'
            OR (
                decision = 'REJECTED'
                AND rejection_note IS NOT NULL
                AND LENGTH(TRIM(rejection_note)) > 0
            )
        )
);