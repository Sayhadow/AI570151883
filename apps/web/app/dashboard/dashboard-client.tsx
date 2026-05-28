"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  Coins,
  History,
  ImagePlus,
  LayoutTemplate,
  LogOut,
  ShieldCheck,
  Users,
  WalletCards
} from "lucide-react";
import type { AuthUser, PointBalanceSummary, PointTransactionSummary } from "@ai-image/shared";
import { apiRequest } from "../../lib/api";

export function DashboardClient() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [balance, setBalance] = useState<PointBalanceSummary | null>(null);
  const [transactions, setTransactions] = useState<PointTransactionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const currentUser = await apiRequest<AuthUser>("/api/auth/me");

        if (currentUser.agreementStatus !== "accepted") {
          window.location.href = "/agreement";
          return;
        }

        const [currentBalance, currentTransactions] = await Promise.all([
          apiRequest<PointBalanceSummary>("/api/points/balance"),
          apiRequest<PointTransactionSummary[]>("/api/points/transactions")
        ]);

        setUser(currentUser);
        setBalance(currentBalance);
        setTransactions(currentTransactions);
      } catch {
        setError("请先登录");
      }
    }

    void loadDashboard();
  }, []);

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
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold transition hover:bg-muted"
            type="button"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            退出
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-6 md:grid-cols-4">
        <InfoTile icon={Coins} title="可用点数" value={String(balance.available)} />
        <InfoTile icon={WalletCards} title="预扣点数" value={String(balance.held)} />
        <InfoTile icon={ShieldCheck} title="协议状态" value={user.agreementStatus === "accepted" ? "已确认" : "待确认"} />
        <InfoTile icon={LayoutTemplate} title="账户角色" value={user.role === "admin" ? "管理员" : "测试用户"} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-8 lg:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">创作入口</h2>
          <div className="mt-4 flex min-h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted">
            <div className="text-center">
              <ImagePlus className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">创作工作台</p>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">快捷入口</h2>
          <div className="mt-4 grid gap-3">
            {user.role === "admin" ? (
              <>
                <Link className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/admin/users">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  用户与充值
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

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">点数流水</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">类型</th>
                  <th className="py-3 pr-4 font-medium">状态</th>
                  <th className="py-3 pr-4 font-medium">点数</th>
                  <th className="py-3 pr-4 font-medium">可用余额</th>
                  <th className="py-3 pr-4 font-medium">说明</th>
                  <th className="py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border">
                    <td className="py-3 pr-4">{formatTransactionType(transaction.type)}</td>
                    <td className="py-3 pr-4">{formatTransactionStatus(transaction.status)}</td>
                    <td className={`py-3 pr-4 font-semibold ${transaction.amount >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {transaction.amount >= 0 ? "+" : ""}
                      {transaction.amount}
                    </td>
                    <td className="py-3 pr-4">{transaction.balanceAfter ?? "-"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{transaction.reason ?? "-"}</td>
                    <td className="py-3 text-muted-foreground">{new Date(transaction.createdAt).toLocaleString()}</td>
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
