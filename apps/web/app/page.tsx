import {
  Activity,
  Coins,
  GalleryHorizontalEnd,
  ImagePlus,
  KeyRound,
  LayoutTemplate,
  LogIn,
  ShieldCheck,
  UserPlus,
  Workflow
} from "lucide-react";
import Link from "next/link";

const modules = [
  { title: "邀请码注册", status: "下一步", icon: KeyRound },
  { title: "登录与协议确认", status: "下一步", icon: ShieldCheck },
  { title: "点数账户", status: "待开发", icon: Coins },
  { title: "创作工作台", status: "待开发", icon: ImagePlus },
  { title: "任务队列", status: "骨架完成", icon: Workflow },
  { title: "结果图库", status: "待开发", icon: GalleryHorizontalEnd },
  { title: "模板 Remix", status: "待开发", icon: LayoutTemplate },
  { title: "后台管理", status: "待开发", icon: Activity }
];

const steps = [
  "邀请码注册",
  "登录 + 安全问题",
  "首次协议确认",
  "上传参考图 + Prompt",
  "提交任务并预扣点",
  "排队生成",
  "结果存储与展示",
  "下载 / 失败退款"
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-primary">内部测试版 MVP</p>
            <h1 className="text-3xl font-semibold tracking-normal text-foreground">AI 生图网站控制台</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              当前先完成本地开发地基：Next.js 前台、NestJS API、BullMQ Worker、PostgreSQL、Redis 和对象存储。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              href="/register"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              邀请码注册
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold"
              href="/login"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              登录
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatusTile label="Web" value="Next.js" detail="用户前台 + 管理后台" />
            <StatusTile label="API" value="NestJS" detail="认证、任务、点数接口" />
            <StatusTile label="Worker" value="BullMQ" detail="异步生成与退款流程" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {modules.map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    {item.status}
                  </span>
                </div>
                <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">核心业务流程</h2>
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step} className="flex min-h-20 gap-3 rounded-md border border-border p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium leading-6">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">本地服务</h2>
            <div className="mt-4 space-y-3 text-sm">
              <ServiceRow label="Web" value="http://localhost:3000" />
              <ServiceRow label="API" value="http://localhost:4000/api/health" />
              <ServiceRow label="MinIO" value="http://localhost:9001" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">当前里程碑</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              下一步会进入认证与邀请码模块，先把内部测试用户入口做完整。
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function StatusTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
    </div>
  );
}

function ServiceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted p-3">
      <span className="font-medium">{label}</span>
      <span className="break-all text-muted-foreground">{value}</span>
    </div>
  );
}
