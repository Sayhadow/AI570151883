"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  GalleryHorizontal,
  Layers3,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2
} from "lucide-react";
import type {
  AuthUser,
  CreateGenerationTaskResponse,
  PointBalanceSummary,
  TemplateSummary
} from "@ai-image/shared";
import { apiRequest } from "../../lib/api";

type Resolution = "1k" | "2k" | "4k";
type AspectRatio =
  | "auto"
  | "1:1"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4"
  | "5:4"
  | "4:5"
  | "16:9"
  | "9:16"
  | "2:1"
  | "1:2"
  | "3:1"
  | "1:3"
  | "21:9"
  | "9:21";

const resolutions: Resolution[] = ["1k", "2k", "4k"];
const aspectRatios: Array<{ label: string; value: AspectRatio }> = [
  { label: "Auto", value: "auto" },
  { label: "1:1", value: "1:1" },
  { label: "3:2", value: "3:2" },
  { label: "2:3", value: "2:3" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "5:4", value: "5:4" },
  { label: "4:5", value: "4:5" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "2:1", value: "2:1" },
  { label: "1:2", value: "1:2" },
  { label: "3:1", value: "3:1" },
  { label: "1:3", value: "1:3" },
  { label: "21:9", value: "21:9" },
  { label: "9:21", value: "9:21" }
];

export function TemplatesClient() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [balance, setBalance] = useState<PointBalanceSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [selectedTemplateId, templates]
  );

  async function loadTemplates() {
    setIsLoading(true);
    setMessage(null);

    try {
      const currentUser = await apiRequest<AuthUser>("/api/auth/me");

      if (currentUser.agreementStatus !== "accepted") {
        window.location.href = "/agreement";
        return;
      }

      const [currentTemplates, currentBalance] = await Promise.all([
        apiRequest<TemplateSummary[]>("/api/templates"),
        apiRequest<PointBalanceSummary>("/api/points/balance")
      ]);

      setTemplates(currentTemplates);
      setSelectedTemplateId((currentId) => currentId ?? currentTemplates[0]?.id ?? null);
      setBalance(currentBalance);
    } catch {
      window.location.href = "/login";
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function remixTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTemplate) {
      return;
    }

    setMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await apiRequest<CreateGenerationTaskResponse>(`/api/templates/${selectedTemplate.id}/remix`, {
        method: "POST",
        body: JSON.stringify({
          prompt: formData.get("prompt") || undefined,
          negativePrompt: formData.get("negativePrompt") || undefined,
          params: {
            ...selectedTemplate.defaultParams,
            resolution: formData.get("resolution"),
            aspectRatio: formData.get("aspectRatio")
          }
        })
      });

      setBalance((currentBalance) =>
        currentBalance
          ? {
              ...currentBalance,
              available: currentBalance.available - result.task.pointCost,
              held: currentBalance.held + result.task.pointCost
            }
          : currentBalance
      );
      form.reset();
      setMessage("Remix 已入队");
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Remix 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="rounded-lg border border-border bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">正在加载模板</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-primary">模板图库</p>
            <h1 className="mt-1 text-2xl font-semibold">Template Remix</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/workspace/home">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              控制台
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/gallery">
              <GalleryHorizontal className="h-4 w-4" aria-hidden="true" />
              图库
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1fr_400px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template, index) => (
            <button
              className={`overflow-hidden rounded-lg border bg-white text-left shadow-sm transition ${
                selectedTemplate?.id === template.id ? "border-primary" : "border-border hover:border-primary"
              }`}
              key={template.id}
              type="button"
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <TemplatePreview index={index} template={template} />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h2 className="text-base font-semibold">{template.title}</h2>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{readParam(template.defaultParams, "stylePreset", "product")}</span>
                  <span>{readParam(template.defaultParams, "aspectRatio", "1:1")}</span>
                  <span>Q{readParam(template.defaultParams, "quality", "1")}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <aside className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Remix</h2>
            </div>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" type="button" onClick={loadTemplates}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              刷新
            </button>
          </div>

          {selectedTemplate ? (
            <form className="mt-4" key={selectedTemplate.id} onSubmit={remixTemplate}>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="text-sm font-semibold">{selectedTemplate.title}</div>
                <div className="mt-2 line-clamp-4 text-sm text-muted-foreground">{selectedTemplate.prompt}</div>
              </div>

              <label className="mt-4 grid gap-2 text-sm font-medium">
                <span>Remix direction</span>
                <textarea
                  className="min-h-28 resize-y rounded-md border border-border px-3 py-2 outline-none focus:border-primary"
                  maxLength={1000}
                  name="prompt"
                  placeholder="例如：改成夏季新品、增加浅色背景、突出玻璃质感"
                />
              </label>

              <label className="mt-4 grid gap-2 text-sm font-medium">
                <span>Negative Prompt</span>
                <input
                  className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary"
                  maxLength={1000}
                  name="negativePrompt"
                  placeholder={selectedTemplate.negativePrompt ?? "低清晰度、变形、文字水印"}
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  <span>清晰度</span>
                  <select
                    className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary"
                    defaultValue={readResolution(selectedTemplate.defaultParams)}
                    name="resolution"
                  >
                    {resolutions.map((resolution) => (
                      <option key={resolution} value={resolution}>
                        {resolution.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  <span>尺寸</span>
                  <select
                    className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary"
                    defaultValue={readAspectRatio(selectedTemplate.defaultParams)}
                    name="aspectRatio"
                  >
                    {aspectRatios.map((aspectRatio) => (
                      <option key={aspectRatio.value} value={aspectRatio.value}>
                        {aspectRatio.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                点数会按所选清晰度和模板张数自动预扣。
              </div>

              <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <Coins className="h-4 w-4 text-primary" aria-hidden="true" />
                  可用 {balance?.available ?? 0}
                </span>
                <span className="text-muted-foreground">预扣 {balance?.held ?? 0}</span>
              </div>

              {message ? <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

              <button
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                提交 Remix
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">暂无模板</p>
          )}
        </aside>
      </section>
    </main>
  );
}

function TemplatePreview({ index, template }: { index: number; template: TemplateSummary }) {
  const palettes = [
    "from-[rgb(255,50,100)] via-[rgb(255,50,180)] to-[rgb(255,50,255)]",
    "from-[rgb(255,50,120)] via-[rgb(255,50,200)] to-[rgb(255,50,255)]",
    "from-[rgb(255,50,100)] via-[rgb(255,50,150)] to-[rgb(255,50,230)]"
  ];
  const palette = palettes[index % palettes.length];

  return (
    <div className={`relative aspect-[4/3] bg-gradient-to-br ${palette}`}>
      <div className="absolute inset-0 grid grid-cols-5 grid-rows-4 gap-2 p-5 opacity-70">
        {Array.from({ length: 20 }).map((_, cellIndex) => (
          <span className="rounded-md bg-white/70 shadow-sm" key={`${template.id}-${cellIndex}`} />
        ))}
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-md border border-white/70 bg-white/80 p-3 shadow-sm">
        <div className="h-2 w-24 rounded-full bg-slate-700" />
        <div className="mt-2 h-2 w-36 rounded-full bg-slate-400" />
      </div>
    </div>
  );
}

function readParam(params: Record<string, unknown>, key: string, fallback: string) {
  const value = params[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function readResolution(params: Record<string, unknown>): Resolution {
  return params.resolution === "4k" ? "4k" : params.resolution === "2k" ? "2k" : "1k";
}

function readAspectRatio(params: Record<string, unknown>): AspectRatio {
  return aspectRatios.some((aspectRatio) => aspectRatio.value === params.aspectRatio)
    ? (params.aspectRatio as AspectRatio)
    : "1:1";
}
