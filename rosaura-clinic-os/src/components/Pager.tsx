import Link from "next/link";

export function Pager({
  basePath,
  page,
  pages,
  total,
  params = {},
}: {
  basePath: string;
  page: number;
  pages: number;
  total: number;
  params?: Record<string, string>;
}) {
  const href = (target: number) => {
    const search = new URLSearchParams(params);
    if (target > 1) search.set("page", String(target));
    const text = search.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  return (
    <nav className="no-print flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Halaman">
      <p className="text-muted">
        {total} data · halaman {page} dari {pages}
      </p>
      <div className="flex gap-3">
        {page > 1 ? (
          <Link className="text-gold-deep" href={href(page - 1)}>
            Sebelumnya
          </Link>
        ) : (
          <span className="text-muted/60">Sebelumnya</span>
        )}
        {page < pages ? (
          <Link className="text-gold-deep" href={href(page + 1)}>
            Berikutnya
          </Link>
        ) : (
          <span className="text-muted/60">Berikutnya</span>
        )}
      </div>
    </nav>
  );
}
