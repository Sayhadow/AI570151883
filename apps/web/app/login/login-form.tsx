"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import type { AuthResponse } from "@ai-image/shared";
import { apiRequest } from "../../lib/api";
import { AuthMessage } from "../../components/auth-message";
import { FormField } from "../../components/form-field";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });

      window.location.href = response.user.agreementStatus === "accepted" ? "/workspace/home" : "/agreement";
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <FormField label="邮箱" type="email" name="email" placeholder="you@example.com" autoComplete="email" />
      <FormField label="密码" type="password" name="password" placeholder="你的登录密码" autoComplete="current-password" />
      <AuthMessage message={error} />
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {isSubmitting ? "登录中" : "登录"}
      </button>
    </form>
  );
}
