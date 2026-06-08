"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Grid3X3,
  ImageIcon,
  RefreshCw,
  Search,
  Wand2
} from "lucide-react";
import type { AuthUser, ResultAssetSummary } from "@ai-image/shared";
import { apiRequest, getApiBaseUrl } from "../../lib/api";

export function GalleryClient() {
  const [assets, setAssets] = useState<ResultAssetSummary[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return assets;
    }

    return assets.filter((asset) => asset.prompt.toLowerCase().includes(normalized));
  }, [assets, query]);

  async function loadGallery() {
    setIsLoading(true);

    try {
      const currentUser = await apiRequest<AuthUser>("/api/auth/me");

      if (currentUser.agreementStatus !== "accepted") {
        window.location.href = "/agreement";
        return;
      }

      setAssets(await apiRequest<ResultAssetSummary[]>("/api/assets/results"));
    } catch {
      window.location.href = "/login";
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadGallery();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-primary">结果图库</p>
            <h1 className="mt-1 text-2xl font-semibold">生成资产</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/workspace/home">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              控制台
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" href="/workspace/home">
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              工作台
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative block min-w-[260px] flex-1 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm outline-none focus:border-primary"
              placeholder="搜索 Prompt"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold" type="button" onClick={loadGallery}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            刷新
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAssets.map((asset, index) => (
            <article className="overflow-hidden rounded-lg border border-border bg-white shadow-sm" key={asset.id}>
              <AssetPreview asset={asset} index={index} />
              <div className="p-4">
                <div className="line-clamp-2 min-h-10 text-sm font-semibold">{asset.prompt}</div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {asset.width ?? 1024} x {asset.height ?? 1024}
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {new Date(asset.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{asset.objectKey}</span>
                  <a
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border"
                    href={asset.contentUrl ? toAbsoluteAssetUrl(asset.contentUrl) : undefined}
                    title={asset.objectKey}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!isLoading && filteredAssets.length === 0 ? (
          <section className="mt-6 flex min-h-64 items-center justify-center rounded-lg border border-dashed border-border bg-white">
            <div className="text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">暂无结果资产</p>
            </div>
          </section>
        ) : null}

        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">加载中</p> : null}
      </section>
    </main>
  );
}

function AssetPreview({ asset, index }: { asset: ResultAssetSummary; index: number }) {
  if (asset.contentUrl) {
    return (
      <div className="relative aspect-square bg-muted">
        <img
          alt={asset.prompt}
          className="h-full w-full object-cover"
          src={toAbsoluteAssetUrl(asset.contentUrl)}
        />
      </div>
    );
  }

  const palettes = [
    "from-[rgb(255,50,100)] via-[rgb(255,50,180)] to-[rgb(255,50,255)]",
    "from-[rgb(255,50,120)] via-[rgb(255,50,200)] to-[rgb(255,50,255)]",
    "from-[rgb(255,50,100)] via-[rgb(255,50,150)] to-[rgb(255,50,230)]",
    "from-[rgb(255,50,140)] via-[rgb(255,50,210)] to-[rgb(255,50,255)]"
  ];
  const palette = palettes[index % palettes.length];

  return (
    <div className={`relative aspect-square bg-gradient-to-br ${palette}`}>
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-px p-6 opacity-50">
        {Array.from({ length: 36 }).map((_, cellIndex) => (
          <span className="rounded-sm bg-white/70" key={`${asset.id}-${cellIndex}`} />
        ))}
      </div>
      <div className="absolute inset-x-5 bottom-5 rounded-md border border-white/70 bg-white/80 p-3 shadow-sm">
        <div className="h-2 w-16 rounded-full bg-slate-700" />
        <div className="mt-2 h-2 w-28 rounded-full bg-slate-400" />
      </div>
    </div>
  );
}

function toAbsoluteAssetUrl(contentUrl: string) {
  return `${getApiBaseUrl()}${contentUrl}`;
}
