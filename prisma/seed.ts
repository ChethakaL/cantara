import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.DEMO_ADMIN_EMAIL ?? "admin@cantara.demo";
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? "CantaraDemo!2026";
  const adminName = process.env.DEMO_ADMIN_NAME ?? "Cantara Admin";

  const passwordHash = await hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.log(`Seeded admin user: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
