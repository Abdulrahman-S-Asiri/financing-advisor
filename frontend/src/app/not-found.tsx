import Link from "next/link";

export default function NotFound() {
  return (
    <main className="sitePage">
      <section className="emptyState siteErrorState">
        <h3>الصفحة غير موجودة</h3>
        <p className="emptyText">الرابط داخل أثر غير متاح أو تم نقله.</p>
        <div className="siteErrorActions">
          <Link className="primaryButton" href="/">
            الرئيسية
          </Link>
          <Link className="siteNavLink" href="/journey">
            ابدأ رحلة أثر
          </Link>
        </div>
      </section>
    </main>
  );
}
