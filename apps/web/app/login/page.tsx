import Link from "next/link";
import { AuthShell } from "../../components/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="登录"
      description="登录后可以进入创作工作台、查看点数和任务状态。"
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

