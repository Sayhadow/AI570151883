import { pbkdf2Sync, randomBytes } from "node:crypto";
import {
  AgreementStatus,
  InviteCodeStatus,
  PointTransactionStatus,
  PointTransactionType,
  Prisma,
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

  const templates = [
    {
      title: "电商产品海报",
      description: "适合单品主视觉、促销图和商品详情首屏。",
      prompt: "A polished ecommerce product poster, clean studio lighting, premium composition, crisp product edges, subtle reflections, modern Chinese brand campaign",
      negativePrompt: "low quality, watermark, distorted product, unreadable text, clutter",
      defaultParams: {
        stylePreset: "product",
        aspectRatio: "4:5",
        quality: 2
      }
    },
    {
      title: "杂志封面人像",
      description: "适合头像、人物故事、活动主视觉。",
      prompt: "An editorial magazine cover portrait, confident subject, refined wardrobe, cinematic lighting, elegant layout space, high-end publication style",
      negativePrompt: "extra fingers, deformed face, harsh shadow, low resolution, watermark",
      defaultParams: {
        stylePreset: "editorial",
        aspectRatio: "4:5",
        quality: 2
      }
    },
    {
      title: "电影感场景图",
      description: "适合概念场景、世界观氛围和叙事画面。",
      prompt: "A cinematic concept art scene, dramatic lighting, deep atmosphere, layered foreground and background, production design quality",
      negativePrompt: "flat lighting, noisy, blurry, overexposed, text artifacts",
      defaultParams: {
        stylePreset: "cinematic",
        aspectRatio: "16:9",
        quality: 3
      }
    }
  ] satisfies Array<{
    title: string;
    description: string;
    prompt: string;
    negativePrompt: string;
    defaultParams: Prisma.InputJsonObject;
  }>;

  for (const template of templates) {
    const existingTemplate = await prisma.template.findFirst({
      where: { title: template.title }
    });

    if (existingTemplate) {
      await prisma.template.update({
        where: { id: existingTemplate.id },
        data: {
          description: template.description,
          prompt: template.prompt,
          negativePrompt: template.negativePrompt,
          defaultParams: template.defaultParams,
          isPublished: true
        }
      });
    } else {
      await prisma.template.create({
        data: {
          ...template,
          isPublished: true
        }
      });
    }
  }

  console.log(`Seeded admin: ${adminEmail}`);
  console.log(`Seeded admin points: ${adminBalance.available}`);
  console.log(`Seeded invite code: ${inviteCode}`);
  console.log(`Seeded templates: ${templates.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
