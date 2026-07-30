-- =====================================================================
-- Neighborhood Library App - PostgreSQL Schema
--
-- STALE: kept for historical reference only. Alembic (backend/alembic/) is
-- the source of truth for the schema; this file has not been updated since
-- the category table / book.is_archived migration and does not reflect the
-- current schema. Run `uv run alembic upgrade head`, not this file.
-- =====================================================================

DROP TABLE IF EXISTS transaction CASCADE;
DROP TABLE IF EXISTS loan CASCADE;
DROP TABLE IF EXISTS book_copy CASCADE;
DROP TABLE IF EXISTS book CASCADE;
DROP TABLE IF EXISTS member CASCADE;
DROP TABLE IF EXISTS staff CASCADE;

DROP TYPE IF EXISTS staff_role CASCADE;
DROP TYPE IF EXISTS staff_status CASCADE;
DROP TYPE IF EXISTS membership_status CASCADE;
DROP TYPE IF EXISTS copy_condition CASCADE;
DROP TYPE IF EXISTS copy_status CASCADE;
DROP TYPE IF EXISTS loan_status CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS payment_mode CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
CREATE TYPE staff_role         AS ENUM ('ADMIN', 'LIBRARIAN');
CREATE TYPE staff_status       AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE membership_status  AS ENUM ('ACTIVE', 'BLOCKED', 'INACTIVE');
CREATE TYPE copy_condition     AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED');
CREATE TYPE copy_status        AS ENUM ('AVAILABLE', 'BORROWED', 'LOST', 'MAINTENANCE');
CREATE TYPE loan_status        AS ENUM ('ACTIVE', 'RETURNED');
CREATE TYPE transaction_type   AS ENUM ('LATE_FEE', 'DAMAGE_FEE', 'WAIVER');
CREATE TYPE payment_mode       AS ENUM ('CASH', 'CARD', 'UPI', 'ONLINE');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'WAIVED');

-- ---------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------
CREATE TABLE staff (
    staff_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code  VARCHAR(32)  NOT NULL UNIQUE,
    first_name     VARCHAR(80)  NOT NULL,
    last_name      VARCHAR(80)  NOT NULL,
    email          VARCHAR(160) NOT NULL UNIQUE,
    phone_number   VARCHAR(20),
    password_hash  VARCHAR(255) NOT NULL,
    role           staff_role   NOT NULL DEFAULT 'LIBRARIAN',
    status         staff_status NOT NULL DEFAULT 'ACTIVE',
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_email         ON staff (email);
CREATE INDEX idx_staff_employee_code ON staff (employee_code);

-- ---------------------------------------------------------------------
-- Member
-- ---------------------------------------------------------------------
CREATE TABLE member (
    member_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name           VARCHAR(80)  NOT NULL,
    last_name            VARCHAR(80)  NOT NULL,
    email                VARCHAR(160) NOT NULL UNIQUE,
    phone_number         VARCHAR(20),
    government_id_type   VARCHAR(40),
    government_id_number VARCHAR(64),
    street               VARCHAR(160),
    city                 VARCHAR(80),
    state                VARCHAR(80),
    postal_code          VARCHAR(20),
    country              VARCHAR(80),
    membership_status    membership_status NOT NULL DEFAULT 'ACTIVE',
    remarks              TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_member_gov_id UNIQUE (government_id_type, government_id_number)
);

CREATE INDEX idx_member_email  ON member (email);
CREATE INDEX idx_member_status ON member (membership_status);

-- ---------------------------------------------------------------------
-- Book (catalog level)
-- ---------------------------------------------------------------------
CREATE TABLE book (
    book_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title          VARCHAR(255) NOT NULL,
    author         VARCHAR(160) NOT NULL,
    publisher      VARCHAR(160),
    isbn           VARCHAR(20) UNIQUE,
    category       VARCHAR(80),
    description    TEXT,
    published_year SMALLINT CHECK (published_year BETWEEN 1400 AND 2100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_book_isbn  ON book (isbn);
CREATE INDEX idx_book_title ON book (title);

-- ---------------------------------------------------------------------
-- BookCopy (physical, borrowable unit)
-- ---------------------------------------------------------------------
CREATE TABLE book_copy (
    copy_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id          UUID NOT NULL REFERENCES book (book_id) ON DELETE RESTRICT,
    barcode          VARCHAR(64) NOT NULL UNIQUE,
    shelf_code       VARCHAR(32),
    condition        copy_condition NOT NULL DEFAULT 'NEW',
    status           copy_status    NOT NULL DEFAULT 'AVAILABLE',
    max_borrow_days  SMALLINT       NOT NULL DEFAULT 14 CHECK (max_borrow_days > 0),
    late_fee_per_day NUMERIC(10,2)  NOT NULL DEFAULT 5.00 CHECK (late_fee_per_day >= 0),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_copy_book_id ON book_copy (book_id);
CREATE INDEX idx_copy_barcode ON book_copy (barcode);
CREATE INDEX idx_copy_status  ON book_copy (status);

-- ---------------------------------------------------------------------
-- Loan
-- ---------------------------------------------------------------------
CREATE TABLE loan (
    loan_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copy_id              UUID NOT NULL REFERENCES book_copy (copy_id) ON DELETE RESTRICT,
    member_id            UUID NOT NULL REFERENCES member (member_id)  ON DELETE RESTRICT,
    issued_by_staff_id   UUID NOT NULL REFERENCES staff (staff_id)    ON DELETE RESTRICT,
    received_by_staff_id UUID          REFERENCES staff (staff_id)    ON DELETE RESTRICT,
    borrowed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at               TIMESTAMPTZ NOT NULL,
    returned_at          TIMESTAMPTZ,
    borrow_condition     copy_condition NOT NULL,
    return_condition     copy_condition,
    status               loan_status    NOT NULL DEFAULT 'ACTIVE',
    calculated_fine      NUMERIC(10,2)  NOT NULL DEFAULT 0.00 CHECK (calculated_fine >= 0),
    remarks              TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at            TIMESTAMPTZ,
    CONSTRAINT chk_loan_due_after_borrow CHECK (due_at > borrowed_at),
    CONSTRAINT chk_loan_returned_state CHECK (
        (status = 'ACTIVE'   AND returned_at IS NULL) OR
        (status = 'RETURNED' AND returned_at IS NOT NULL)
    )
);

CREATE INDEX idx_loan_member_id ON loan (member_id);
CREATE INDEX idx_loan_copy_id   ON loan (copy_id);
CREATE INDEX idx_loan_status    ON loan (status);
CREATE INDEX idx_loan_due_at    ON loan (due_at);

-- Composite index for the overdue-listing query.
CREATE INDEX idx_loan_status_due_at ON loan (status, due_at);

-- Core business rule, enforced in the DB rather than the app layer:
-- a copy can only be on one ACTIVE loan at a time. This closes the
-- check-then-insert race under concurrent borrow requests.
CREATE UNIQUE INDEX one_active_loan_per_copy
    ON loan (copy_id) WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------
-- Transaction (fee ledger)
-- ---------------------------------------------------------------------
CREATE TABLE transaction (
    transaction_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id           UUID          REFERENCES loan (loan_id)     ON DELETE RESTRICT,
    member_id         UUID NOT NULL REFERENCES member (member_id) ON DELETE RESTRICT,
    transaction_type  transaction_type   NOT NULL,
    payment_mode      payment_mode,
    amount            NUMERIC(10,2)      NOT NULL CHECK (amount >= 0),
    payment_reference VARCHAR(80),
    status            transaction_status NOT NULL DEFAULT 'PENDING',
    created_at        TIMESTAMPTZ        NOT NULL DEFAULT now(),
    -- A waiver is not a payment, so it carries no payment_mode.
    CONSTRAINT chk_txn_waiver_mode CHECK (
        (transaction_type = 'WAIVER' AND payment_mode IS NULL) OR
        (transaction_type <> 'WAIVER')
    )
);

CREATE INDEX idx_txn_member_id  ON transaction (member_id);
CREATE INDEX idx_txn_loan_id    ON transaction (loan_id);
CREATE INDEX idx_txn_status     ON transaction (status);
CREATE INDEX idx_txn_created_at ON transaction (created_at);
