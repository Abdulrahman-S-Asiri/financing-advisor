import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterGrid">
        <div>
          <p className="siteFooterBrand">مستشار التمويل</p>
          <p className="siteFooterNote">
            مستشار تمويل وكيلي يقرأ الوضع المالي، يقارن العروض، ويشرح كل قرار
            بالعربية.
          </p>
          <p className="siteFooterDisclaimer">
            منصة تجريبية — البيانات البنكية محاكاة، أسعار العروض غير مؤكدة،
            والقرار النهائي دائماً للجهة التمويلية.
          </p>
        </div>

        <nav className="siteFooterLinks" aria-label="روابط الموقع">
          <Link href="/journey">ابدأ الرحلة</Link>
          <Link href="/docs">كيف يعمل</Link>
          <Link href="/status">حالة المنصة</Link>
        </nav>

        <div>
          <p className="siteFooterNote">
            الأرقام كلها من محرك حسابي مُختبر؛ النموذج اللغوي يشرح فقط ولا
            يحسب. <Link href="/docs">اقرأ كيف يعمل ذلك</Link>.
          </p>
        </div>
      </div>
    </footer>
  );
}
