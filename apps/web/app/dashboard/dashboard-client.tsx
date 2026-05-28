"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, ImagePlus, LayoutTemplate, LogOut, ShieldCheck } from "lucide-react";
import type { AuthUser } from "@ai-image/shared";
import { apiRequest } from "../../lib/api";

export function DashboardClient() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<AuthUser>("/api/auth/me")
      .then((currentUser) => {
        if (currentUser.agreementStatus !== "accepted") {
          window.location.href = "/agreement";
          return;
        }

        setUser(currentUser);
      })
      .catch(() => setError("请先登录"));
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

  if (!user) {
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

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-6 md:grid-cols-3">
        <InfoTile icon={Coins} title="可用点数" value={String(user.pointsAvailable)} />
        <InfoTile icon={ShieldCheck} title="协议状态" value={user.agreementStatus === "accepted" ? "已确认" : "待确认"} />
        <InfoTile icon={LayoutTemplate} title="账号角色" value={user.role === "admin" ? "管理员" : "测试用户"} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-8 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">创作入口</h2>
          <div className="mt-4 flex min-h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted">
            <div className="text-center">
              <ImagePlus className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">下一阶段接入上传参考图、Prompt 和任务队列</p>
            </div>
          </div>
        </div>
        {user.role === "admin" ? (
          <aside className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">管理员</h2>
            <Link className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/admin/invite-codes">
              管理邀请码
            </Link>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

function InfoTile({
  icon: Icon,
  title,
  value
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
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
