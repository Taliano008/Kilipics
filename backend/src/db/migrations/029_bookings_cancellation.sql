-- Who cancelled a booking, and whether the merchant has seen it.
--
-- cancelled_by lets the server tell a customer's cancellation (final — the
-- merchant can't revive it) from the merchant's own decline (which they can
-- undo). NULL on a cancelled row means it was cancelled before this column
-- existed; those are treated as the merchant's own.
--
-- cancel_acknowledged_at drives the "Cancelled by customer" alert on the
-- merchant's Bookings tab: a customer cancellation stays there, and in the
-- tab badge, until the merchant dismisses it.
ALTER TABLE bookings
  ADD COLUMN cancelled_by VARCHAR(10)
    CONSTRAINT bookings_cancelled_by_check CHECK (cancelled_by IN ('customer','merchant')),
  ADD COLUMN cancel_acknowledged_at TIMESTAMP(3);
