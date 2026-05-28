import { pbkdf2Sync, randomBytes } from "node:crypto";
import {
  AgreementStatus,
  InviteCodeStatus,
  PointTransactionStatus,
  PointTransactionType,
  PrismaClient,
  UserRole
} from "@prisma/client";

const prisma = new PrismaClient();

const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2:${DIGEST}:${ITERATIONS}:${salt}:${hash}`;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345";
  const inviteCode = (process.env.SEED_INVITE_CODE ?? "INTERNAL-TEST-2026").toUpperCase();
  const adminPoints = Number(process.env.SEED_ADMIN_POINTS ?? 1000);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: UserRole.ADMIN,
      agreementStatus: AgreementStatus.ACCEPTED
    },
    create: {
      email: adminEmail,
      displayName: "Internal Admin",
      passwordHash: hashPassword(adminPassword),
      role: UserRole.ADMIN,
      agreementStatus: AgreementStatus.ACCEPTED
    }
  });

  let adminBalance = await prisma.userBalance.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      available: 0,
      held: 0
    }
  });

  if (Number.isInteger(adminPoints) && adminPoints > 0) {
    const existingSeedGrant = await prisma.pointTransaction.findFirst({
      where: {
        userId: admin.id,
        type: PointTransactionType.ADMIN_GRANT,
        reason: "Initial seed points"
      }
    });

    if (!existingSeedGrant) {
      adminBalance = await prisma.userBalance.update({
        where: { userId: admin.id },
        data: {
          available: { increment: adminPoints }
        }
      });

      await prisma.pointTransaction.create({
        data: {
          userId: admin.id,
          type: PointTransactionType.ADMIN_GRANT,
          status: PointTransactionStatus.COMMITTED,
          amount: adminPoints,
          balanceAfter: adminBalance.available,
          heldAfter: adminBalance.held,
          reason: "Initial seed points",
          committedAt: new Date()
        }
      });
    }
  }

  await prisma.inviteCode.upsert({
    where: { code: inviteCode },
    update: {},
    create: {
      code: inviteCode,
      status: InviteCodeStatus.ACTIVE,
      maxUses: 20,
      note: "Initial internal test invite"
    }
  });

  console.log(`Seeded admin: ${adminEmail}`);
  console.log(`Seeded admin points: ${adminBalance.available}`);
  console.log(`Seeded invite code: ${inviteCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
