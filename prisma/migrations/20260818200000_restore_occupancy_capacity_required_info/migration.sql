-- Re-enable Capacity Model questions for Occupancy Review in Required Info
INSERT INTO "AgentFormQuestion"
  ("id", "agentId", "agentName", "fieldKey", "label", "description", "inputType", "placeholder", "required", "options", "groupKey", "groupLabel", "sortOrder", "isActive")
VALUES
  ('occupancy_review_totalDailyCapacity', 'occupancy_review', 'Occupancy Review Agent', 'occupancyTotalDailyCapacity', 'Total Daily Capacity (Owner-Stated Max)', 'Owner-stated total capacity is preferred. Daycare spots = Total - Boarding Runs if left blank.', 'number', 'e.g., 75', false, NULL, 'occupancy_capacity', 'Capacity Model', 400, true),
  ('occupancy_review_boardingRuns', 'occupancy_review', 'Occupancy Review Agent', 'occupancyBoardingRuns', 'Boarding Runs / Kennels', 'Number of boarding runs or suites at full capacity.', 'number', 'e.g., 45', false, NULL, 'occupancy_capacity', 'Capacity Model', 410, true),
  ('occupancy_review_daycareSpots', 'occupancy_review', 'Occupancy Review Agent', 'occupancyDaycareSpots', 'Daycare Spots', 'Leave blank to auto-calculate as Total Capacity minus Boarding Runs.', 'number', 'e.g., 30', false, NULL, 'occupancy_capacity', 'Capacity Model', 420, true),
  ('occupancy_review_groomingStations', 'occupancy_review', 'Occupancy Review Agent', 'occupancyGroomingStations', 'Grooming Stations', 'Optional. Number of grooming stations if applicable.', 'number', 'e.g., 6', false, NULL, 'occupancy_capacity', 'Capacity Model', 430, true)
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
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Keep monthly data textarea inactive (collected via Document Upload spreadsheet)
UPDATE "AgentFormQuestion"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "agentId" = 'occupancy_review' AND "fieldKey" = 'occupancyMonthlyData';
