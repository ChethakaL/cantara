-- Add CLIENT_PORTAL_INVITE to ClientEmailNotificationType enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ClientEmailNotificationType'
      AND e.enumlabel = 'CLIENT_PORTAL_INVITE'
  ) THEN
    ALTER TYPE "ClientEmailNotificationType" ADD VALUE 'CLIENT_PORTAL_INVITE';
  END IF;
END $$;
