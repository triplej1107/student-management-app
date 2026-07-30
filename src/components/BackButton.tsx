import Link from "next/link";

export function BackButton({ href }: { href: string }) {
  return (
    <div className="flex justify-end">
      <Link
        href={href}
        aria-label="뒤로가기"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-lg leading-none text-ink-secondary shadow-[0_1px_4px_rgba(20,30,60,0.10)]"
      >
        ‹
      </Link>
    </div>
  );
}
