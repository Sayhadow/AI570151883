import { Injectable } from "@nestjs/common";
import { Asset, AssetKind, GenerationTask } from "@ai-image/db";
import type { ResultAssetSummary } from "@ai-image/shared";
import { PrismaService } from "../prisma/prisma.service.js";

type ResultAssetWithTask = Asset & {
  task: GenerationTask | null;
};

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
