"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Clock,
  Coins,
  DatabaseZap,
  RefreshCw,
  Search,
  Users
} from "lucide-react";
import type {
  AdminGenerationTaskSummary,
  AdminOverviewSummary,
  GenerationStatus
} from "@ai-image/shared";
import { apiRequest } from "../../../lib/api";

const statusOptions: Array<GenerationStatus | "all"> = [
  "all",
  "queued",
  "processing",
  "succeeded",
  "refunded",
  "failed"
];

export function AdminTasksClient() {
  const [overview, setOverview] = useState<AdminOverviewSummary | null>(null);
  const [tasks, setTasks] = useState<AdminGenerationTaskSummary[]>([]);
  const [status, setStatus] = useState<GenerationStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const statusMatches = status === "all" || task.status === status;
      const queryMatches =
        !normalizedQuery ||
        task.prompt.toLowerCase().includes(normalizedQuery) ||
        task.userEmail.toLowerCase().includes(normalizedQuery);

      return statusMatches && queryMatches;
    });
  }, [query, status, tasks]);

  async function loadAdminTasks() {
    setIsLoading(true);
    setMessage(null);

    try {
      const [currentOverview, currentTasks] = await Promise.all([
        apiRequest<AdminOverviewSummary>("/api/admin/overview"),
        apiRequest<AdminGenerationTaskSummary[]>("/api/admin/tasks")
      ]);

      setOverview(currentOverview);
      setTasks(currentTasks);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminTasks();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-primary">后台管理</p>
            <h1 className="mt-1 text-2xl font-semibold">任务日志</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/workspace/home">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              控制台
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/admin/users">
              <Users className="h-4 w-4" aria-hidden="true" />
              用户
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile icon={Users} title="用户数" value={String(overview?.totalUsers ?? 0)} />
          <MetricTile icon={Activity} title="任务数" value={String(overview?.totalTasks ?? 0)} />
          <MetricTile icon={Clock} title="处理中" value={String((overview?.queuedTasks ?? 0) + (overview?.processingTasks ?? 0))} />
          <MetricTile icon={Coins} title="平台点数" value={`${overview?.totalAvailablePoints ?? 0}/${overview?.totalHeldPoints ?? 0}`} />
        </div>

        <div className="mt-6 rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">生成任务</h2>
            </div>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" type="button" onClick={loadAdminTasks}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              刷新
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="relative block min-w-[240px] flex-1 md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                className="h-10 w-full rounded-md border border-border pl-9 pr-3 text-sm outline-none focus:border-primary"
                placeholder="搜索用户邮箱或 Prompt"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <button
                  className={`h-9 rounded-md border px-3 text-sm font-semibold ${
                    status === option ? "border-primary bg-muted" : "border-border bg-white"
                  }`}
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                >
                  {formatTaskStatus(option)}
                </button>
              ))}
            </div>
          </div>

          {message ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">任务</th>
                  <th className="py-3 pr-4 font-medium">用户</th>
                  <th className="py-3 pr-4 font-medium">状态</th>
                  <th className="py-3 pr-4 font-medium">点数</th>
                  <th className="py-3 pr-4 font-medium">资产/流水</th>
                  <th className="py-3 pr-4 font-medium">Provider</th>
                  <th className="py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="border-b border-border align-top">
                    <td className="max-w-96 py-3 pr-4">
                      <div className="line-clamp-2 font-semibold">{task.prompt}</div>
                      {task.errorMessage ? <div className="mt-1 text-xs text-red-700">{task.errorMessage}</div> : null}
                      <div className="mt-1 text-xs text-muted-foreground">{task.id}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{task.userDisplayName || task.userEmail}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{task.userEmail}</div>
                    </td>
                    <td className="py-3 pr-4">{formatTaskStatus(task.status)}</td>
                    <td className="py-3 pr-4">{task.pointCost}</td>
                    <td className="py-3 pr-4">
                      {task.resultAssetCount}/{task.pointTransactionCount}
                    </td>
                    <td className="py-3 pr-4">
                      <div>{task.latestProviderCall?.provider ?? task.provider}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatProviderCall(task.latestProviderCall)}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && filteredTasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无任务</p> : null}
            {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">加载中</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricTile({
  icon: Icon,
  title,
  value
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-primary" aria-hidden={true} />
      <div className="mt-3 text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function formatTaskStatus(status: GenerationStatus | "all") {
  const labels: Record<GenerationStatus | "all", string> = {
    all: "全部",
    draft: "草稿",
    queued: "排队中",
    processing: "生成中",
    succeeded: "已完成",
    failed: "失败",
    refunded: "已退款"
  };

  return labels[status];
}

function formatProviderCall(call: AdminGenerationTaskSummary["latestProviderCall"]) {
  if (!call) {
    return "暂无调用";
  }

  if (call.errorMessage) {
    return call.errorMessage;
  }

  const statusCode = call.statusCode ? `${call.statusCode}` : "无状态码";
  const duration = call.durationMs === null ? "无耗时" : `${call.durationMs}ms`;
  return `${statusCode} · ${duration}`;
}
