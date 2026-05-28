import { AuthShell } from "../../components/auth-shell";
import { AgreementForm } from "./agreement-form";

export default function AgreementPage() {
  return (
    <AuthShell title="首次协议确认" description="首次登录后需要确认内部测试协议，之后才能进入创作流程。" footer="协议确认后将进入用户控制台。">
      <AgreementForm />
    </AuthShell>
  );
}

