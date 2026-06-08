import Link from "next/link";

export function AuthShell({
  title,
  description,
  children,
  footer
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="sayhadow-auth grid min-h-screen bg-[#050506] text-white lg:grid-cols-2">
      <section className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <Link className="absolute left-8 top-8 text-sm font-semibold text-white/70 transition hover:text-white" href="/">
          ← 返回
        </Link>
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-3 text-xl font-semibold text-white">
            <span className="sayhadow-logo-mark grid h-9 w-9 place-items-center rounded-xl text-sm font-black text-white">S</span>
            Sayhadow
          </Link>
          <div className="mt-16">
            <h1 className="text-center text-3xl font-semibold tracking-normal">{title}</h1>
            <p className="mt-3 text-center text-sm leading-6 text-white/45">{description}</p>
          </div>
          <div className="mt-10">{children}</div>
          <div className="mt-8 text-center text-sm leading-6 text-white/45">{footer}</div>
        </div>
      </section>

      <section className="relative hidden min-h-screen overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1600&q=85')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" />
        <div className="sayhadow-logo-mark absolute right-8 top-8 grid h-12 w-12 place-items-center rounded-full border border-white/20 text-lg font-semibold text-white shadow-[0_0_32px_rgba(255,50,180,0.28)] backdrop-blur">
          S
        </div>
        <div className="absolute bottom-12 left-12 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur">
            <span className="text-lg leading-none">✦</span>
            Sayhadow
          </div>
          <h2 className="mt-5 text-4xl font-semibold leading-tight">
            为电商团队生成更快、更稳、更有转化力的视觉内容
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-white/70">
            从商品信息识别到图片规划，再到主图与场景图生成，把电商视觉生产流程收进一个平台。
          </p>
        </div>
      </section>
    </main>
  );
}
