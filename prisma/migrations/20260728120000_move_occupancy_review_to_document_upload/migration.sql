-- Occupancy Review is now collected as an Assigned Documents upload.
-- Keep the legacy rows for backwards compatibility, but hide them from
-- the client portal Required Info form.
UPDATE "AgentFormQuestion"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "agentId" = 'occupancy_review';
