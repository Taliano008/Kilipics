-- A consumer can now pick several services on the provider page and ask
-- about all of them in one availability request. service_ids holds every
-- selected service id in the order picked; service_id stays as the first
-- of them so the admin list and anything already reading it keep working.
ALTER TABLE availability_requests
  ADD COLUMN service_ids JSONB NOT NULL DEFAULT '[]';
