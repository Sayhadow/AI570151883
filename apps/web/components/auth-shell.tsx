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
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-primary">
          AI 生图网站
        </Link>
        <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">{footer}</div>
      </section>
    </main>
  );
}

