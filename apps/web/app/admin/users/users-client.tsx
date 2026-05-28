"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, DatabaseZap, RefreshCw } from "lucide-react";
import type { AdminPointGrantResponse, AdminUserSummary } from "@ai-image/shared";
import { apiRequest } from "../../../lib/api";

export function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);

  async function loadUsers() {
    setIsLoading(true);
    setMessage(null);

    try {
      setUsers(await apiRequest<AdminUserSummary[]>("/api/admin/users"));
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function grantPoints(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setMessage(null);
    setSubmittingUserId(userId);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await apiRequest<AdminPointGrantResponse>(`/api/admin/users/${userId}/points`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(formData.get("amount")),
          reason: formData.get("reason") || undefined
        })
      });

      setUsers((currentUsers) => currentUsers.map((user) => (user.id === result.user.id ? result.user : user)));
      form.reset();
      setMessage(`已为 ${result.user.email} 充值 ${result.transaction.amount} 点`);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "充值失败");
    } finally {
      setSubmittingUserId(null);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-primary">后台管理</p>
            <h1 className="mt-1 text-2xl font-semibold">用户与充值</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/dashboard">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回控制台
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" href="/admin/tasks">
              <DatabaseZap className="h-4 w-4" aria-hidden="true" />
              任务日志
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">用户列表</h2>
            </div>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold" type="button" onClick={loadUsers}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              刷新
            </button>
          </div>

          {message ? <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">用户</th>
                  <th className="py-3 pr-4 font-medium">角色</th>
                  <th className="py-3 pr-4 font-medium">协议</th>
                  <th className="py-3 pr-4 font-medium">可用</th>
                  <th className="py-3 pr-4 font-medium">预扣</th>
                  <th className="py-3 pr-4 font-medium">任务/资产</th>
                  <th className="py-3 pr-4 font-medium">最近任务</th>
                  <th className="py-3 font-medium">充值</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border align-top">
                    <td className="py-3 pr-4">
                      <div className="font-semibold">{user.displayName || user.email}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="py-3 pr-4">{user.role === "admin" ? "管理员" : "用户"}</td>
                    <td className="py-3 pr-4">{user.agreementStatus === "accepted" ? "已确认" : "待确认"}</td>
                    <td className="py-3 pr-4 font-semibold">{user.pointsAvailable}</td>
                    <td className="py-3 pr-4">{user.pointsHeld}</td>
                    <td className="py-3 pr-4">
                      {user.generationTaskCount}/{user.resultAssetCount}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {user.lastTaskAt ? new Date(user.lastTaskAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-3">
                      <form className="flex flex-wrap gap-2" onSubmit={(event) => grantPoints(event, user.id)}>
                        <input
                          className="h-9 w-28 rounded-md border border-border px-3 outline-none focus:border-primary"
                          min="1"
                          max="1000000"
                          name="amount"
                          placeholder="点数"
                          required={true}
                          type="number"
                        />
                        <input
                          className="h-9 w-52 rounded-md border border-border px-3 outline-none focus:border-primary"
                          maxLength={200}
                          name="reason"
                          placeholder="备注"
                        />
                        <button
                          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                          disabled={submittingUserId === user.id}
                          type="submit"
                        >
                          <Coins className="h-4 w-4" aria-hidden="true" />
                          充值
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && users.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无用户</p> : null}
            {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">加载中</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
