"use client";

import { useEffect, useState } from "react";
import type { ComponentType, FormEvent } from "react";
import Link from "next/link";
import {
  Coins,
  GalleryHorizontal,
  History,
  ImageIcon,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  LogOut,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  Wand2,
  DatabaseZap,
  WalletCards
} from "lucide-react";
import type {
  AuthUser,
  CreateGenerationTaskResponse,
  GenerationTaskSummary,
  PointBalanceSummary,
  PointTransactionSummary
} from "@ai-image/shared";
import { apiRequest } from "../../lib/api";

export function DashboardClient() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [balance, setBalance] = useState<PointBalanceSummary | null>(null);
  const [transactions, setTransactions] = useState<PointTransactionSummary[]>([]);
  const [tasks, setTasks] = useState<GenerationTaskSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadDashboard() {
    setIsRefreshing(true);

    try {
      const currentUser = await apiRequest<AuthUser>("/api/auth/me");

      if (currentUser.agreementStatus !== "accepted") {
        window.location.href = "/agreement";
        return;
      }

      const [currentBalance, currentTransactions, currentTasks] = await Promise.all([
        apiRequest<PointBalanceSummary>("/api/points/balance"),
        apiRequest<PointTransactionSummary[]>("/api/points/transactions"),
        apiRequest<GenerationTaskSummary[]>("/api/generation-tasks")
      ]);

      setUser(currentUser);
      setBalance(currentBalance);
      setTransactions(currentTransactions);
      setTasks(currentTasks);
      setError(null);
    } catch {
      setError("请先登录");
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await apiRequest<CreateGenerationTaskResponse>("/api/generation-tasks", {
        method: "POST",
        body: JSON.stringify({
          prompt: formData.get("prompt"),
          negativePrompt: formData.get("negativePrompt") || undefined,
          pointCost: Number(formData.get("pointCost") || 10)
        })
      });

      setTasks((currentTasks) => [result.task, ...currentTasks]);
      form.reset();
      setMessage("任务已入队");
      await loadDashboard();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "任务创建失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    await apiRequest<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
    window.location.href = "/login";
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="rounded-lg border border-border bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/login">
            去登录
          </Link>
        </section>
      </main>
    );
  }

  if (!user || !balance) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="rounded-lg border border-border bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">正在加载账户信息</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-primary">内部测试控制台</p>
            <h1 className="mt-1 text-2xl font-semibold">{user.displayName || user.email}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold transition hover:bg-muted"
              type="button"
              onClick={loadDashboard}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              刷新
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold transition hover:bg-muted"
              type="button"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              退出
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-6 md:grid-cols-4">
        <InfoTile icon={Coins} title="可用点数" value={String(balance.available)} />
        <InfoTile icon={WalletCards} title="预扣点数" value={String(balance.held)} />
        <InfoTile icon={ShieldCheck} title="协议状态" value={user.agreementStatus === "accepted" ? "已确认" : "待确认"} />
        <InfoTile icon={LayoutTemplate} title="账户角色" value={user.role === "admin" ? "管理员" : "测试用户"} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-8 lg:grid-cols-[1fr_380px]">
        <form className="rounded-lg border border-border bg-white p-5 shadow-sm" onSubmit={createTask}>
          <div className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">创作任务</h2>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>Prompt</span>
            <textarea
              className="min-h-28 resize-y rounded-md border border-border px-3 py-2 outline-none focus:border-primary"
              maxLength={2000}
              name="prompt"
              placeholder="例如：一张未来感产品海报，冷光金属材质，干净背景"
              required={true}
            />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>Negative Prompt</span>
            <input
              className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary"
              maxLength={1000}
              name="negativePrompt"
              placeholder="例如：低清晰度、畸形、文字水印"
            />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>点数成本</span>
            <input
              className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary"
              defaultValue="10"
              max="10000"
              min="1"
              name="pointCost"
              required={true}
              type="number"
            />
          </label>
          {message ? <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
          <button
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            提交任务
          </button>
        </form>

        <aside className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">快捷入口</h2>
          <div className="mt-4 grid gap-3">
            <Link className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/workspace">
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              创作工作台
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold" href="/gallery">
              <GalleryHorizontal className="h-4 w-4" aria-hidden="true" />
              结果图库
            </Link>
            {user.role === "admin" ? (
              <>
                <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold" href="/admin/users">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  用户与充值
                </Link>
                <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold" href="/admin/tasks">
                  <DatabaseZap className="h-4 w-4" aria-hidden="true" />
                  任务日志
                </Link>
                <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold" href="/admin/invite-codes">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  邀请码管理
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">普通用户</p>
            )}
          </div>
        </aside>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 lg:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">生成任务</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Prompt</th>
                  <th className="py-3 pr-4 font-medium">状态</th>
                  <th className="py-3 pr-4 font-medium">点数</th>
                  <th className="py-3 pr-4 font-medium">结果</th>
                  <th className="py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-border align-top">
                    <td className="max-w-80 py-3 pr-4">
                      <div className="line-clamp-2 font-medium">{task.prompt}</div>
                      {task.errorMessage ? <div className="mt-1 text-xs text-red-700">{task.errorMessage}</div> : null}
                    </td>
                    <td className="py-3 pr-4">{formatTaskStatus(task.status)}</td>
                    <td className="py-3 pr-4">{task.pointCost}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{task.assets[0]?.objectKey ?? "-"}</td>
                    <td className="py-3 text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无生成任务</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">点数流水</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">类型</th>
                  <th className="py-3 pr-4 font-medium">点数</th>
                  <th className="py-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border">
                    <td className="py-3 pr-4">{formatTransactionType(transaction.type)}</td>
                    <td className={`py-3 pr-4 font-semibold ${transaction.amount >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {transaction.amount >= 0 ? "+" : ""}
                      {transaction.amount}
                    </td>
                    <td className="py-3">{formatTransactionStatus(transaction.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无点数流水</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoTile({
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

function formatTransactionType(type: PointTransactionSummary["type"]) {
  const labels: Record<PointTransactionSummary["type"], string> = {
    admin_grant: "管理员充值",
    generation_hold: "生成预扣",
    generation_capture: "确认扣点",
    generation_refund: "失败退款",
    adjustment: "手动调整"
  };

  return labels[type];
}

function formatTransactionStatus(status: PointTransactionSummary["status"]) {
  const labels: Record<PointTransactionSummary["status"], string> = {
    pending: "处理中",
    committed: "已完成",
    reversed: "已撤销",
    failed: "失败"
  };

  return labels[status];
}
