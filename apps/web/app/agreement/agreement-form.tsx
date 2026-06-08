"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { AuthResponse, AuthUser } from "@ai-image/shared";
import { apiRequest } from "../../lib/api";
import { AuthMessage } from "../../components/auth-message";

export function AgreementForm() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<AuthUser>("/api/auth/me")
      .then((currentUser) => {
        setUser(currentUser);

        if (currentUser.agreementStatus === "accepted") {
          window.location.href = "/workspace/home";
        }
      })
      .catch(() => setError("请先登录后再确认协议"));
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isChecked) {
      setError("请先确认内部测试协议");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiRequest<AuthResponse>("/api/auth/agreement/accept", {
        method: "POST",
        body: JSON.stringify({})
      });
      window.location.href = "/workspace/home";
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "协议确认失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="rounded-md border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">
        <p>账号：{user?.email ?? "未登录"}</p>
        <p className="mt-3">
          内部测试期间，生成结果、Prompt、参考图和任务日志仅用于产品验证。请勿上传敏感、违法或未经授权的内容。
        </p>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
        <input
          className="mt-1 h-4 w-4"
          type="checkbox"
          checked={isChecked}
          onChange={(event) => setIsChecked(event.currentTarget.checked)}
        />
        <span>我已阅读并同意内部测试协议，理解测试阶段的内容与服务限制。</span>
      </label>
      <AuthMessage message={error} />
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting || !user}
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {isSubmitting ? "确认中" : "确认并进入"}
      </button>
      {!user ? (
        <Link className="text-center text-sm font-semibold text-primary" href="/login">
          返回登录
        </Link>
      ) : null}
    </form>
  );
}
