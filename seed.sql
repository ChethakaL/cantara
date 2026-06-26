-- Cantara Portal Database Seed Script
-- Usage: psql -U your_user -d your_db -f seed.sql
-- newly created etest testp client password: LY%Ng%Xc9C&9
-- 1. Ensure Admin exists
-- NOTE: In production, passwordHash should be a Bcrypt hash.
INSERT INTO "User" (id, name, email, "passwordHash", role, "updatedAt")
VALUES (
  'admin-1', 
  'Cantara Admin', 
  'admin@cantara.demo', 
  'CantaraDemo!2026', 
  'ADMIN', 
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET 
  "passwordHash" = EXCLUDED."passwordHash",
  role = 'ADMIN',
  "updatedAt" = CURRENT_TIMESTAMP;

-- 2. Sample Client: Marcus Chen (Happy Tails Boarding)
INSERT INTO "User" (id, name, email, "passwordHash", role, "updatedAt")
VALUES (
  'user-marcus', 
  'Marcus Chen', 
  'marcus@happytails.com', 
  'password123', 
  'CLIENT', 
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ClientProfile" (id, "userId", "businessName", "businessDescription", email, workstream, "businessType", stage, "updatedAt", "notes", "valuationDocUploaded", "provisionedAt")
VALUES (
  'c1', 
  'user-marcus', 
  'Happy Tails Boarding', 
  'Premium pet boarding and daycare services with 3 Seattle locations.',
  'marcus@happytails.com', 
  'BOTH', 
  'SINGLE', 
  'COLLECTION', 
  CURRENT_TIMESTAMP,
  'Three Seattle locations. Parent entity: Happy Tails Holdings LLC.',
  true,
  CURRENT_TIMESTAMP - INTERVAL '5 days'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Sample Client: Sarah Williams (PetCare Plus LLC)
INSERT INTO "User" (id, name, email, "passwordHash", role, "updatedAt")
VALUES (
  'user-sarah', 
  'Sarah Williams', 
  'sarah@petcareplus.com', 
  'password123', 
  'CLIENT', 
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ClientProfile" (id, "userId", "businessName", "businessDescription", email, workstream, "businessType", stage, "updatedAt", "valuationDocUploaded")
VALUES (
  'c2', 
  'user-sarah', 
  'PetCare Plus LLC', 
  'Small animal veterinary clinic specializing in exotic pets.',
  'sarah@petcareplus.com', 
  'WS1', 
  'SINGLE', 
  'REVIEW', 
  CURRENT_TIMESTAMP,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Sample Branch for Marcus
INSERT INTO "Branch" (id, name, "clientId")
VALUES ('branch-1', 'Seattle - Capitol Hill', 'c1')
ON CONFLICT (id) DO NOTHING;

-- 5. Sample Requirements for Marcus
INSERT INTO "AdditionalRequirement" (id, "clientId", title, description, priority, status, "createdAt")
VALUES (
  'req-1', 
  'c1', 
  'Updated P&L for Q4 2025', 
  'Please provide the final version of the Q4 Profit & Loss statement for the Capitol Hill location.', 
  'HIGH', 
  'OPEN', 
  CURRENT_TIMESTAMP - INTERVAL '2 days'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Sample Chat messages for Marcus
INSERT INTO "ChatMessage" (id, "clientId", "senderRole", "senderName", message, timestamp)
VALUES (
  'msg-1', 
  'c1', 
  'ADMIN', 
  'Craig Pollack', 
  'Hello Marcus, I have reviewed your initial documents. Could you please provide the Q4 P&L?', 
  CURRENT_TIMESTAMP - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "ChatMessage" (id, "clientId", "senderRole", "senderName", message, timestamp)
VALUES (
  'msg-2', 
  'c1', 
  'CLIENT', 
  'Marcus Chen', 
  'Sure thing, I will upload it by tomorrow.', 
  CURRENT_TIMESTAMP - INTERVAL '12 hours'
)
ON CONFLICT (id) DO NOTHING;

-- 7. Sample Question (legacy compatibility)
INSERT INTO "Question" (id, "clientId", "askedById", question, "createdAt")
VALUES ('q-1', 'c1', 'admin-1', 'Are there any outstanding liens on the equipment?', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
