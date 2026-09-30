-- The Sales tab's hand-entered transactions and income targets, which used
-- to live only in the phone's local storage (lost on reinstall or a new
-- phone). Booking-derived sales aren't stored here — those are read from
-- `bookings`.
CREATE TABLE IF NOT EXISTS sales_transactions (
  id           CHAR(26) PRIMARY KEY,
  business_id  CHAR(26) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type         VARCHAR(10) NOT NULL
                 CONSTRAINT sales_transactions_type_check CHECK (type IN ('income','expense')),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  description  VARCHAR(255) NOT NULL,
  method       VARCHAR(40) NOT NULL DEFAULT 'Cash',
  -- The merchant's local calendar day, as chosen on their phone — not
  -- derived from created_at, which is UTC.
  occurred_on  DATE NOT NULL,
  -- Set only for rows uploaded from a phone's old local store: the id the
  -- row had there, so a retried upload can't create duplicates.
  client_ref   VARCHAR(64),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT sales_transactions_client_ref_uk UNIQUE (business_id, client_ref)
);

CREATE INDEX IF NOT EXISTS sales_transactions_business_date_idx
  ON sales_transactions (business_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS sales_goals (
  business_id  CHAR(26) PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  daily        INTEGER NOT NULL CHECK (daily >= 0),
  weekly       INTEGER NOT NULL CHECK (weekly >= 0),
  monthly      INTEGER NOT NULL CHECK (monthly >= 0),
  updated_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER sales_goals_set_updated_at
  BEFORE UPDATE ON sales_goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Same reason as 022_enable_row_level_security.sql.
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_goals        ENABLE ROW LEVEL SECURITY;
