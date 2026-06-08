import { pbkdf2Sync, randomBytes } from "node:crypto";
import { config } from "dotenv";
import {
  AgreementStatus,
  InviteCodeStatus,
  PointTransactionStatus,
  PointTransactionType,
  Prisma,
  PrismaClient,
  UserRole
} from "@prisma/client";

config({ path: new URL("../../../.env", import.meta.url) });

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
      title: "拼多多玩具商品套图",
      description: "覆盖平台主图、卖点图、细节图、场景图和转化图，适合玩具和低客单商品。",
      prompt: "生成适合拼多多平台的玩具商品套图，主体清晰，信息直接，突出趣味性和购买理由。",
      negativePrompt: "低清晰度、水印、产品变形、错误结构、杂乱背景",
      defaultParams: {
        category: "suite",
        tags: ["玩具", "拼多多", "高点击"],
        preset: "ecommerce_suite",
        imageCount: 5,
        resolution: "1k",
        extraPrompt: "适合拼多多平台，突出商品主体、趣味性和购买理由。",
        previewUrl: "https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "淘宝通用商品套图",
      description: "一套覆盖展示、细节、场景和卖点的通用商品图片，适合快速搭建详情页。",
      prompt: "生成淘宝通用商品套图，画面干净，强调产品质感、功能细节和真实使用价值。",
      negativePrompt: "低清晰度、水印、产品变形、比例错误、文字乱码",
      defaultParams: {
        category: "suite",
        tags: ["淘宝", "通用商品", "详情页"],
        preset: "ecommerce_suite",
        imageCount: 5,
        resolution: "1k",
        extraPrompt: "适合淘宝商品详情页，兼顾质感展示、功能说明和使用场景。",
        previewUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "纯白底平台主图",
      description: "生成清晰规范的白底商品主图，适合平台首图、搜索结果和商品列表。",
      prompt: "生成纯白棚拍风格的电商平台主图，商品居中，边缘清晰，比例准确。",
      negativePrompt: "低清晰度、水印、产品变形、复杂背景、多余道具",
      defaultParams: {
        category: "main",
        tags: ["白底图", "首图", "平台规范"],
        preset: "ecommerce_main",
        mainStyleId: "white_studio",
        imageCount: 3,
        resolution: "1k",
        extraPrompt: "以平台规范的纯白棚拍效果展示商品，主体居中，边缘清晰。",
        previewUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "高级感数码主图",
      description: "克制的科技灯光和现代陈列，适合数码、电子和功能型商品。",
      prompt: "生成具有现代科技感的高端数码商品主图，灯光克制，结构清晰。",
      negativePrompt: "低清晰度、水印、产品变形、过度科幻、杂乱霓虹",
      defaultParams: {
        category: "main",
        tags: ["数码", "科技感", "高端"],
        preset: "ecommerce_main",
        mainStyleId: "future_tech",
        imageCount: 3,
        resolution: "1k",
        extraPrompt: "适合数码商品，画面现代克制，突出结构、材质和功能感。",
        previewUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "家居生活场景图",
      description: "将商品放进自然舒适的家庭环境，展示尺寸关系和真实使用状态。",
      prompt: "生成真实自然的家居生活场景图，空间整洁，商品用途清楚。",
      negativePrompt: "低清晰度、水印、产品变形、不合理空间、杂乱陈设",
      defaultParams: {
        category: "scene",
        tags: ["家居", "生活方式", "真实场景"],
        preset: "ecommerce_scene",
        imageCount: 3,
        resolution: "1k",
        extraPrompt: "放入自然舒适的家居环境，展示合理尺寸关系和真实使用状态。",
        previewUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "美妆质感棚拍图",
      description: "柔和商业光、精致展台和细腻材质表现，适合美妆与护理商品。",
      prompt: "生成高级美妆棚拍商品图，光线柔和，陈列精致，强调质感。",
      negativePrompt: "低清晰度、水印、产品变形、脏污背景、刺眼高光",
      defaultParams: {
        category: "main",
        tags: ["美妆", "棚拍", "质感"],
        preset: "ecommerce_main",
        mainStyleId: "luxury_display",
        imageCount: 3,
        resolution: "1k",
        extraPrompt: "适合美妆和护理商品，使用精致展台、柔和商业光和细腻质感。",
        previewUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "材质细节展示图",
      description: "突出纹理、结构、接口和工艺细节，适合补充商品详情页。",
      prompt: "生成商品材质细节图，聚焦纹理、边缘、接口和关键结构。",
      negativePrompt: "低清晰度、水印、产品变形、虚焦、错误细节",
      defaultParams: {
        category: "detail",
        tags: ["细节图", "材质", "工艺"],
        preset: "ecommerce_suite",
        imageCount: 3,
        resolution: "2k",
        extraPrompt: "重点突出材质、纹理、边缘、接口或关键结构，画面适合商品详情页。",
        previewUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "卖点文字留白图",
      description: "保留适合后期排版的干净区域，突出产品主体和核心卖点。",
      prompt: "生成具有排版留白的电商卖点图，主体清晰，画面简洁。",
      negativePrompt: "低清晰度、水印、产品变形、文字乱码、背景杂乱",
      defaultParams: {
        category: "detail",
        tags: ["卖点图", "留白", "详情页"],
        preset: "ecommerce_suite",
        imageCount: 3,
        resolution: "1k",
        extraPrompt: "为后期卖点排版保留干净区域，主体明确，画面不要生成乱码文字。",
        previewUrl: "https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "节日促销氛围图",
      description: "在商品清晰可见的前提下加入节庆氛围，适合活动页和广告投放。",
      prompt: "生成节日促销氛围商品图，视觉醒目但克制，保留商品辨识度。",
      negativePrompt: "低清晰度、水印、产品变形、过度装饰、文字乱码",
      defaultParams: {
        category: "promotion",
        tags: ["促销", "节日", "活动页"],
        preset: "ecommerce_main",
        mainStyleId: "festival_promotion",
        imageCount: 3,
        resolution: "1k",
        extraPrompt: "加入克制的节庆促销氛围，同时确保商品主体清晰、结构准确。",
        previewUrl: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      title: "小红书种草场景图",
      description: "更自然的生活方式构图，适合社交媒体封面和内容种草。",
      prompt: "生成小红书风格的生活方式商品场景图，氛围自然，构图有内容感。",
      negativePrompt: "低清晰度、水印、产品变形、过度摆拍、杂乱背景",
      defaultParams: {
        category: "scene",
        tags: ["小红书", "种草", "生活方式"],
        preset: "ecommerce_scene",
        imageCount: 3,
        resolution: "1k",
        extraPrompt: "使用自然生活方式构图，适合小红书封面和内容种草，避免过度摆拍。",
        previewUrl: "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=900&q=80"
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

  await prisma.template.updateMany({
    where: {
      title: {
        in: ["电商产品海报", "杂志封面人像", "电影感场景图"]
      }
    },
    data: {
      isPublished: false
    }
  });

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
