-- Ensure Digital Presence agent form questions exist in the client portal.
-- Safe to run multiple times (uses ON CONFLICT DO UPDATE).

INSERT INTO "AgentFormQuestion"
  ("id", "agentId", "agentName", "fieldKey", "label", "description", "inputType", "placeholder", "required", "options", "groupKey", "groupLabel", "sortOrder", "isActive")
VALUES
  ('digital_presence_businessWebsite', 'digital_presence', 'Digital Presence Agent', 'businessWebsite', 'Business website', 'Main business website or most relevant service/pricing page.', 'url', 'https://yourbusiness.com', true, NULL, 'business', 'Business Information', 10, true),
  ('digital_presence_googleBusinessProfileUrl', 'digital_presence', 'Digital Presence Agent', 'googleBusinessProfileUrl', 'Google Business Profile URL', 'Public Google Business Profile or Maps listing URL.', 'url', 'https://maps.google.com/...', false, NULL, 'digital_presence', 'Digital Presence', 20, true),
  ('digital_presence_googleBusinessLocations', 'digital_presence', 'Digital Presence Agent', 'googleBusinessLocations', 'Google Business locations', 'List all Google Business Profile locations if there are multiple branches.', 'textarea', 'Downtown profile URL, North Shore profile URL...', false, NULL, 'digital_presence', 'Digital Presence', 30, true),
  ('digital_presence_facebookHandle', 'digital_presence', 'Digital Presence Agent', 'facebookHandle', 'Facebook page', NULL, 'text', 'https://facebook.com/yourbusiness or @handle', false, NULL, 'digital_presence', 'Digital Presence', 40, true),
  ('digital_presence_instagramHandle', 'digital_presence', 'Digital Presence Agent', 'instagramHandle', 'Instagram profile', NULL, 'text', 'https://instagram.com/yourbusiness or @handle', false, NULL, 'digital_presence', 'Digital Presence', 50, true),
  ('digital_presence_tiktokHandle', 'digital_presence', 'Digital Presence Agent', 'tiktokHandle', 'TikTok profile', NULL, 'text', 'https://tiktok.com/@yourbusiness or @handle', false, NULL, 'digital_presence', 'Digital Presence', 60, true),
  ('digital_presence_bookingPlatformUrl', 'digital_presence', 'Digital Presence Agent', 'bookingPlatformUrl', 'Booking platform URL', 'Online booking link (Gingr, Paw Partner, PetExec, or similar).', 'url', 'https://...', false, NULL, 'digital_presence', 'Digital Presence', 70, true),
  ('digital_presence_yelpUrl', 'digital_presence', 'Digital Presence Agent', 'yelpUrl', 'Yelp profile', NULL, 'url', 'https://www.yelp.com/biz/...', false, NULL, 'digital_presence', 'Digital Presence', 80, true),
  ('digital_presence_nextdoorUrl', 'digital_presence', 'Digital Presence Agent', 'nextdoorUrl', 'Nextdoor profile', NULL, 'url', 'https://nextdoor.com/pages/...', false, NULL, 'digital_presence', 'Digital Presence', 90, true),
  ('digital_presence_linkedinUrl', 'digital_presence', 'Digital Presence Agent', 'linkedinUrl', 'LinkedIn profile', NULL, 'url', 'https://linkedin.com/company/...', false, NULL, 'digital_presence', 'Digital Presence', 100, true),
  ('digital_presence_glassdoorUrl', 'digital_presence', 'Digital Presence Agent', 'glassdoorUrl', 'Glassdoor profile', NULL, 'url', 'https://glassdoor.com/...', false, NULL, 'digital_presence', 'Digital Presence', 110, true),
  ('digital_presence_bbbUrl', 'digital_presence', 'Digital Presence Agent', 'bbbUrl', 'BBB profile', NULL, 'url', 'https://www.bbb.org/...', false, NULL, 'digital_presence', 'Digital Presence', 120, true)
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
