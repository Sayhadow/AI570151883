"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import type { AuthResponse } from "@ai-image/shared";
import { apiRequest } from "../../lib/api";
import { AuthMessage } from "../../components/auth-message";
import { FormField } from "../../components/form-field";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          inviteCode: formData.get("inviteCode"),
          email: formData.get("email"),
          displayName: formData.get("displayName"),
          password: formData.get("password")
        })
      });

      window.location.href = response.user.agreementStatus === "accepted" ? "/dashboard" : "/agreement";
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "注册失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <FormField label="邀请码" name="inviteCode" placeholder="INTERNAL-TEST-2026" autoComplete="one-time-code" />
      <FormField label="邮箱" type="email" name="email" placeholder="you@example.com" autoComplete="email" />
      <FormField label="昵称" name="displayName" placeholder="你的显示名称" autoComplete="name" required={false} />
      <FormField label="密码" type="password" name="password" placeholder="至少 8 位" autoComplete="new-password" />
      <AuthMessage message={error} />
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {isSubmitting ? "注册中" : "使用邀请码注册"}
      </button>
    </form>
  );
}

