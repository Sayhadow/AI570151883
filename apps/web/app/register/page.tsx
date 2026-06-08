import Link from "next/link";
import { AuthShell } from "../../components/auth-shell";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="加入 Sayhadow"
      description="内部测试阶段仅允许持邀请码的用户创建账户。"
      footer={
        <>
          已有账号？{" "}
          <Link className="font-semibold text-primary" href="/login">
            去登录
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
