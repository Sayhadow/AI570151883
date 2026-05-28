export function AuthMessage({ message, tone = "error" }: { message: string | null; tone?: "error" | "success" }) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={
        tone === "success"
          ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      }
    >
      {message}
    </p>
  );
}

