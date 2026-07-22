-- Occupancy Review Agent — client portal required-info questions.
-- Safe to run multiple times.

INSERT INTO "AgentFormQuestion"
  ("id", "agentId", "agentName", "fieldKey", "label", "description", "inputType", "placeholder", "required", "options", "groupKey", "groupLabel", "sortOrder", "isActive")
VALUES
  ('occupancy_review_totalDailyCapacity', 'occupancy_review', 'Occupancy Review Agent', 'occupancyTotalDailyCapacity', 'Total daily capacity (dogs)', 'Owner-stated maximum daily capacity across boarding and daycare combined.', 'number', '75', false, NULL, 'occupancy_capacity', 'Capacity Model', 400, true),
  ('occupancy_review_boardingRuns', 'occupancy_review', 'Occupancy Review Agent', 'occupancyBoardingRuns', 'Total boarding runs / kennels', 'Number of boarding runs or suites at full capacity.', 'number', '45', false, NULL, 'occupancy_capacity', 'Capacity Model', 410, true),
  ('occupancy_review_daycareSpots', 'occupancy_review', 'Occupancy Review Agent', 'occupancyDaycareSpots', 'Total daycare spots', 'Leave blank to auto-calculate as Total Capacity minus Boarding Runs.', 'number', '30', false, NULL, 'occupancy_capacity', 'Capacity Model', 420, true),
  ('occupancy_review_groomingStations', 'occupancy_review', 'Occupancy Review Agent', 'occupancyGroomingStations', 'Grooming stations', 'Optional. Number of grooming stations if applicable.', 'number', '6', false, NULL, 'occupancy_capacity', 'Capacity Model', 430, true),
  ('occupancy_review_monthlyData', 'occupancy_review', 'Occupancy Review Agent', 'occupancyMonthlyData', '24-month occupancy data', 'One month per line: YYYY-MM|boarding dogs|daycare dogs. Example: 2024-07|52|18. Provide up to 24 consecutive months.', 'textarea', '2024-01|45|30' || E'\n' || '2024-02|42|28', false, NULL, 'occupancy_monthly', 'Monthly Dog Counts', 440, true)
ON CONFLICT ("agentId", "fieldKey") DO UPDATE SET
  "agentName" = EXCLUDED."agentName",
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "inputType" = EXCLUDED."inputType",
  "placeholder" = EXCLUDED."placeholder",
  "required" = EXCLUDED."required",
  "options" = EXCLUDED."options",
  "groupKey" = EXCLUDED."groupKey",
  "groupLabel" = EXCLUDED."groupLabel",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;
