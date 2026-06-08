import { createReadStream, readFileSync } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Asset, AssetKind, GenerationTask } from "@ai-image/db";
import type { ResultAssetSummary } from "@ai-image/shared";
import { PrismaService } from "../prisma/prisma.service.js";

type ResultAssetWithTask = Asset & {
  task: GenerationTask | null;
};

interface TemplateCoverUploadInput {
  fileName?: string;
  mimeType?: string;
  dataUri?: string;
}

@Injectable()
export class AssetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listResultAssets(userId: string): Promise<ResultAssetSummary[]> {
    const assets = await this.prisma.asset.findMany({
      where: {
        userId,
        kind: AssetKind.RESULT
      },
      include: {
        task: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    return assets.filter((asset) => asset.task).map((asset) => this.toResultAssetSummary(asset));
  }

  async getResultAssetContent(userId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        userId,
        kind: AssetKind.RESULT
      }
    });

    if (!asset || asset.bucket !== "local" || !asset.objectKey.startsWith("local-results/")) {
      throw new NotFoundException("Result asset not found");
    }

    const fileName = path.basename(asset.objectKey);
    const filePath = path.join(resolveGeneratedAssetDir(), fileName);

    try {
      await access(filePath);
    } catch {
      throw new NotFoundException("Result asset file not found");
    }

    return {
      stream: createReadStream(filePath),
      fileName,
      mimeType: asset.mimeType ?? "image/png"
    };
  }

  async uploadTemplateCover(input: TemplateCoverUploadInput) {
    const mimeType = this.normalizeTemplateCoverMimeType(input.mimeType);
    const bytes = this.decodeDataUri(input.dataUri, mimeType);
    const extension = this.getTemplateCoverExtension(mimeType);
    const objectFileName = `${randomUUID()}.${extension}`;
    const assetDir = path.join(resolveGeneratedAssetDir(), "template-covers");
    const objectKey = `template-covers/${objectFileName}`;

    await mkdir(assetDir, { recursive: true });
    await writeFile(path.join(assetDir, objectFileName), bytes);

    const asset = await this.prisma.asset.create({
      data: {
        kind: AssetKind.TEMPLATE_COVER,
        bucket: "local",
        objectKey,
        mimeType,
        sizeBytes: bytes.length
      }
    });

    return {
      id: asset.id,
      contentUrl: `/api/assets/template-covers/${asset.id}/content`,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      originalFileName: input.fileName?.trim() || null
    };
  }

  async getTemplateCoverContent(assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        kind: AssetKind.TEMPLATE_COVER
      }
    });

    if (!asset || asset.bucket !== "local" || !asset.objectKey.startsWith("template-covers/")) {
      throw new NotFoundException("Template cover not found");
    }

    const fileName = path.basename(asset.objectKey);
    const filePath = path.join(resolveGeneratedAssetDir(), "template-covers", fileName);

    try {
      await access(filePath);
    } catch {
      throw new NotFoundException("Template cover file not found");
    }

    return {
      stream: createReadStream(filePath),
      fileName,
      mimeType: asset.mimeType ?? "image/png"
    };
  }

  private toResultAssetSummary(asset: ResultAssetWithTask): ResultAssetSummary {
    const task = asset.task;

    if (!task) {
      throw new Error("Result asset is missing task");
    }

    return {
      id: asset.id,
      taskId: task.id,
      kind: "result",
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      contentUrl: asset.bucket === "local" ? `/api/assets/results/${asset.id}/content` : null,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt.toISOString(),
      prompt: task.prompt,
      negativePrompt: task.negativePrompt,
      taskCreatedAt: task.createdAt.toISOString(),
      taskCompletedAt: task.completedAt?.toISOString() ?? null
    };
  }

  private normalizeTemplateCoverMimeType(mimeType: string | undefined) {
    const normalized = mimeType?.trim().toLowerCase();

    if (normalized === "image/png" || normalized === "image/jpeg" || normalized === "image/webp") {
      return normalized;
    }

    throw new BadRequestException("Template cover must be a PNG, JPEG, or WebP image");
  }

  private decodeDataUri(dataUri: string | undefined, mimeType: string) {
    if (!dataUri || typeof dataUri !== "string") {
      throw new BadRequestException("Template cover image is required");
    }

    const prefix = `data:${mimeType};base64,`;

    if (!dataUri.startsWith(prefix)) {
      throw new BadRequestException("Template cover data URI does not match its MIME type");
    }

    const bytes = Buffer.from(dataUri.slice(prefix.length), "base64");
    const maxSizeBytes = 5 * 1024 * 1024;

    if (bytes.length < 1) {
      throw new BadRequestException("Template cover image is empty");
    }

    if (bytes.length > maxSizeBytes) {
      throw new BadRequestException("Template cover image must be 5MB or less");
    }

    return bytes;
  }

  private getTemplateCoverExtension(mimeType: string) {
    if (mimeType === "image/jpeg") {
      return "jpg";
    }

    if (mimeType === "image/webp") {
      return "webp";
    }

    return "png";
  }
}

function resolveGeneratedAssetDir() {
  const configured = process.env.GENERATED_ASSET_DIR;

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(findWorkspaceRoot(), configured);
  }

  return path.join(findWorkspaceRoot(), ".generated-assets");
}

function findWorkspaceRoot() {
  let current = process.cwd();

  while (true) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(current, "package.json"), "utf8")) as { name?: string };

      if (pkg.name === "ai-image-platform") {
        return current;
      }
    } catch {
      // Keep walking up until the workspace root is found.
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}
