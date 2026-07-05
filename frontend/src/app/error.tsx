"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="sitePage">
      <section className="emptyState siteErrorState">
        <h3>حدث خطأ غير متوقع</h3>
        <p className="emptyText">
          {error.message || "تعذر عرض هذه الصفحة. حاول مرة أخرى."}
        </p>
        <div className="siteErrorActions">
          <button className="primaryButton" type="button" onClick={() => reset()}>
            إعادة المحاولة
          </button>
          <Link className="siteNavLink" href="/">
            العودة للرئيسية
          </Link>
        </div>
      </section>
    </main>
  );
}
