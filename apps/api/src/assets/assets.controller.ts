import { Body, Controller, Get, Inject, Param, Post, Query, Req, StreamableFile } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { AssetsService } from "./assets.service.js";

@Controller("assets")
export class AssetsController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AssetsService) private readonly assetsService: AssetsService
  ) {}

  @Get("results")
  async results(@Req() request: Request) {
    const user = await this.authService.getCurrentUser(request);
    return this.assetsService.listResultAssets(user.id);
  }

  @Get("results/:assetId/content")
  async resultContent(@Req() request: Request, @Param("assetId") assetId: string, @Query("download") download?: string) {
    const user = await this.authService.getCurrentUser(request);
    const asset = await this.assetsService.getResultAssetContent(user.id, assetId);
    const dispositionType = download === "1" || download === "true" ? "attachment" : "inline";

    return new StreamableFile(asset.stream, {
      type: asset.mimeType,
      disposition: `${dispositionType}; filename="${asset.fileName}"`
    });
  }

  @Post("template-covers")
  async uploadTemplateCover(@Req() request: Request, @Body() body: unknown) {
    await this.authService.requireAdmin(request);
    return this.assetsService.uploadTemplateCover(body as { fileName?: string; mimeType?: string; dataUri?: string });
  }

  @Get("template-covers/:assetId/content")
  async templateCoverContent(@Param("assetId") assetId: string) {
    const asset = await this.assetsService.getTemplateCoverContent(assetId);

    return new StreamableFile(asset.stream, {
      type: asset.mimeType,
      disposition: `inline; filename="${asset.fileName}"`
    });
  }
}
