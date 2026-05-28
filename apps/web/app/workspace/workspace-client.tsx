"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brush,
  Coins,
  GalleryHorizontal,
  ImagePlus,
  Layers3,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Wand2
} from "lucide-react";
import type {
  AuthUser,
  CreateGenerationTaskResponse,
  GenerationTaskSummary,
  PointBalanceSummary
} from "@ai-image/shared";
import { apiRequest } from "../../lib/api";

const stylePresets = [
  { id: "product", label: "产品", swatch: "bg-sky-500" },
  { id: "editorial", label: "杂志", swatch: "bg-emerald-500" },
  { id: "cinematic", label: "电影", swatch: "bg-amber-500" }
] as const;

const aspectRatios = ["1:1", "4:5", "16:9"] as const;

export function WorkspaceClient() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [balance, setBalance] = useState<PointBalanceSummary | null>(null);
  const [tasks, setTasks] = useState<GenerationTaskSummary[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<(typeof stylePresets)[number]["id"]>("product");
  const [selectedRatio, setSelectedRatio] = useState<(typeof aspectRatios)[number]>("1:1");
  const [quality, setQuality] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status === "queued" || task.status === "processing"),
    [tasks]
  );

  async function loadWorkspace() {
    setIsLoading(true);

    try {
      const currentUser = await apiRequest<AuthUser>("/api/auth/me");

      if (currentUser.agreementStatus !== "accepted") {
        window.location.href = "/agreement";
        return;
      }

      const [currentBalance, currentTasks] = await Promise.all([
        apiRequest<PointBalanceSummary>("/api/points/balance"),
        apiRequest<GenerationTaskSummary[]>("/api/generation-tasks")
      ]);

      setUser(currentUser);
      setBalance(currentBalance);
      setTasks(currentTasks);
    } catch {
      window.location.href = "/login";
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const pointCost = 10 * quality;

    try {
      const result = await apiRequest<CreateGenerationTaskResponse>("/api/generation-tasks", {
        method: "POST",
        body: JSON.stringify({
          prompt: formData.get("prompt"),
          negativePrompt: formData.get("negativePrompt") || undefined,
          pointCost,
          params: {
            aspectRatio: selectedRatio,
            stylePreset: selectedStyle,
            quality
          }
        })
      });

      setTasks((currentTasks) => [result.task, ...currentTasks]);
      setBalance((currentBalance) =>
        currentBalance
          ? {
              ...currentBalance,
              available: currentBalance.available - pointCost,
              held: currentBalance.held + pointCost
            }
          : currentBalance
      );
      form.reset();
      setMessage("任务已入队");
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "任务创建失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !user || !balance) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="rounded-lg border border-border bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">正在加载工作台</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-primary">创作工作台</p>
            <h1 className="mt-1 text-2xl font-semibold">{user.displayName || user.email}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/dashboard">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              控制台
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/templates">
              <Layers3 className="h-4 w-4" aria-hidden="true" />
              模板
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" href="/gallery">
              <GalleryHorizontal className="h-4 w-4" aria-hidden="true" />
              图库
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[420px_1fr]">
        <form className="rounded-lg border border-border bg-white p-5 shadow-sm" onSubmit={createTask}>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">生成设置</h2>
          </div>

          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>Prompt</span>
            <textarea
              className="min-h-36 resize-y rounded-md border border-border px-3 py-2 outline-none focus:border-primary"
              maxLength={2000}
              name="prompt"
              placeholder="一张清爽的 AI 生图网站海报，主视觉是未来感图像编辑器界面"
              required={true}
            />
          </label>

          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>Negative Prompt</span>
            <input
              className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary"
              maxLength={1000}
              name="negativePrompt"
              placeholder="低清晰度、文字水印、变形"
            />
          </label>

          <div className="mt-4">
            <div className="text-sm font-medium">风格</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {stylePresets.map((preset) => (
                <button
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-semibold ${
                    selectedStyle === preset.id ? "border-primary bg-muted" : "border-border bg-white"
                  }`}
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedStyle(preset.id)}
                >
                  <span className={`h-3 w-3 rounded-full ${preset.swatch}`} aria-hidden="true" />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">画幅</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {aspectRatios.map((ratio) => (
                <button
                  className={`h-10 rounded-md border text-sm font-semibold ${
                    selectedRatio === ratio ? "border-primary bg-muted" : "border-border bg-white"
                  }`}
                  key={ratio}
                  type="button"
                  onClick={() => setSelectedRatio(ratio)}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>质量等级：{quality}</span>
            <input
              max="3"
              min="1"
              type="range"
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
          </label>

          <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              <Coins className="h-4 w-4 text-primary" aria-hidden="true" />
              {10 * quality} 点
            </span>
            <span className="text-muted-foreground">可用 {balance.available}</span>
          </div>

          {message ? <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

          <button
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            提交生成
          </button>
        </form>

        <div className="grid gap-6">
          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ImagePlus className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="text-lg font-semibold">任务队列</h2>
              </div>
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" type="button" onClick={loadWorkspace}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                刷新
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {tasks.slice(0, 6).map((task) => (
                <article className="rounded-md border border-border p-3" key={task.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="line-clamp-2 text-sm font-semibold">{task.prompt}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{formatTaskStatus(task.status)}</span>
                        <span>{task.pointCost} 点</span>
                        <span>{formatTaskParams(task.params)}</span>
                      </div>
                    </div>
                    <TaskStatusIcon status={task.status} />
                  </div>
                </article>
              ))}
              {tasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无任务</p> : null}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">当前状态</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <StatusTile title="排队中" value={String(activeTasks.filter((task) => task.status === "queued").length)} />
              <StatusTile title="生成中" value={String(activeTasks.filter((task) => task.status === "processing").length)} />
              <StatusTile title="已完成" value={String(tasks.filter((task) => task.status === "succeeded").length)} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function StatusTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted p-3">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function TaskStatusIcon({ status }: { status: GenerationTaskSummary["status"] }) {
  if (status === "queued" || status === "processing") {
    return <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-primary" aria-hidden="true" />;
  }

  if (status === "succeeded") {
    return <Sparkles className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />;
  }

  return <Brush className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

function formatTaskStatus(status: GenerationTaskSummary["status"]) {
  const labels: Record<GenerationTaskSummary["status"], string> = {
    draft: "草稿",
    queued: "排队中",
    processing: "生成中",
    succeeded: "已完成",
    failed: "失败",
    refunded: "已退款"
  };

  return labels[status];
}

function formatTaskParams(params: Record<string, unknown>) {
  const ratio = typeof params.aspectRatio === "string" ? params.aspectRatio : "1:1";
  const style = typeof params.stylePreset === "string" ? params.stylePreset : "product";
  return `${style} · ${ratio}`;
}
