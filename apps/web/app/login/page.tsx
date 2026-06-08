import Link from "next/link";
import { AuthShell } from "../../components/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="欢迎使用 Sayhadow"
      description="首次登录享限时 AI 生图积分福利"
      footer={
        <>
          没有账号？{" "}
          <Link className="font-semibold text-primary" href="/register">
            用邀请码注册
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
