import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-2xl font-semibold">Страница не найдена</p>
      <Link href="/" className="text-sm font-semibold text-[#8a6a00]">
        На главную
      </Link>
    </div>
  );
}
