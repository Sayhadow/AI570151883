"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DatabaseZap, Plus, RefreshCw } from "lucide-react";
import type { InviteCodeSummary } from "@ai-image/shared";
import { apiRequest } from "../../../lib/api";

export function InviteCodesClient() {
  const [inviteCodes, setInviteCodes] = useState<InviteCodeSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadInviteCodes() {
    setIsLoading(true);
    setMessage(null);

    try {
      setInviteCodes(await apiRequest<InviteCodeSummary[]>("/api/admin/invite-codes"));
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function createInviteCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData(event.currentTarget);

    try {
      await apiRequest<InviteCodeSummary>("/api/admin/invite-codes", {
        method: "POST",
        body: JSON.stringify({
          code: formData.get("code") || undefined,
          maxUses: Number(formData.get("maxUses") || 1),
          note: formData.get("note") || undefined
        })
      });
      event.currentTarget.reset();
      await loadInviteCodes();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "创建失败");
    }
  }

  useEffect(() => {
    void loadInviteCodes();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-primary">后台管理</p>
            <h1 className="mt-1 text-2xl font-semibold">邀请码</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link className="text-sm font-semibold text-primary" href="/admin/tasks">
              <DatabaseZap className="mr-1 inline h-4 w-4" aria-hidden="true" />
              任务日志
            </Link>
            <Link className="text-sm font-semibold text-primary" href="/dashboard">
              返回控制台
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <form className="rounded-lg border border-border bg-white p-5 shadow-sm" onSubmit={createInviteCode}>
          <h2 className="text-lg font-semibold">创建邀请码</h2>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>自定义码</span>
            <input className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary" name="code" placeholder="留空自动生成" />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>可用次数</span>
            <input className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary" name="maxUses" type="number" min="1" max="100" defaultValue="1" />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>备注</span>
            <input className="h-10 rounded-md border border-border px-3 outline-none focus:border-primary" name="note" placeholder="例如：第一批内测" />
          </label>
          {message ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
          <button className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" type="submit">
            <Plus className="h-4 w-4" aria-hidden="true" />
            创建
          </button>
        </form>

        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">邀请码列表</h2>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" type="button" onClick={loadInviteCodes}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              刷新
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">邀请码</th>
                  <th className="py-3 pr-4 font-medium">状态</th>
                  <th className="py-3 pr-4 font-medium">使用</th>
                  <th className="py-3 pr-4 font-medium">备注</th>
                  <th className="py-3 font-medium">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.map((inviteCode) => (
                  <tr key={inviteCode.id} className="border-b border-border">
                    <td className="py-3 pr-4 font-semibold">{inviteCode.code}</td>
                    <td className="py-3 pr-4">{inviteCode.status}</td>
                    <td className="py-3 pr-4">
                      {inviteCode.usedCount}/{inviteCode.maxUses}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{inviteCode.note ?? "-"}</td>
                    <td className="py-3 text-muted-foreground">{new Date(inviteCode.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && inviteCodes.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无邀请码</p> : null}
            {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">加载中</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
