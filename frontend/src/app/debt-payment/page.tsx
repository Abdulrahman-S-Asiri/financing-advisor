import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "سداد المديونية قريباً",
  description:
    "ميزة قادمة لمحاكاة سداد المديونية وقياس أثرها على الملاءة قبل طلب تمويل جديد.",
};

const plannedCapabilities = [
  {
    title: "قراءة الالتزامات القائمة",
    text: "تلخيص الأقساط والبطاقات والالتزامات المتكررة من بيانات مصرفية محاكاة قبل اقتراح أي خطوة.",
  },
  {
    title: "محاكاة أثر السداد",
    text: "إظهار كيف يتغير عبء الالتزامات والمساحة التمويلية عند سداد دين كامل أو جزئي.",
  },
  {
    title: "خطة تنفيذ واضحة",
    text: "ترتيب الخطوات والمستندات المطلوبة دون إرسال طلب أو تنفيذ تحويل حقيقي من داخل العرض التجريبي.",
  },
];

const guardrails = [
  "لا توجد حالياً أي عملية دفع أو تحويل أموال داخل المنصة.",
  "أي حساب مالي مستقبلي سيبقى من المحرك الحتمي في core/ وليس من طبقة الشرح.",
  "الميزة ستظل موسومة كتجريبية حتى يوجد تكامل مرخص ومراجع.",
];

export default function DebtPaymentPage() {
  return (
    <main className="sitePage debtPaymentPage">
      <section className="debtPaymentHero">
        <span className="warningBadge">قريباً</span>
        <p className="eyebrow">سداد المديونية</p>
        <h1>افهم أثر سداد ديونك قبل طلب تمويل جديد</h1>
        <p className="debtPaymentLead">
          ميزة قادمة تساعد العميل على رؤية الالتزامات القائمة، ومحاكاة أثر سدادها
          على نسب الملاءة والأهلية، ثم اختيار المسار الأنسب قبل أي طلب تمويل.
        </p>
        <div className="debtPaymentActions">
          <Link className="primaryButton" href="/journey">
            جرّب رحلة التمويل الحالية
          </Link>
          <Link className="landingCtaSecondary" href="/docs">
            كيف تُحسب الأرقام
          </Link>
        </div>
      </section>

      <section className="landingSection" aria-label="ما الذي ستضيفه الميزة">
        <h2>ما الذي ستضيفه؟</h2>
        <p className="landingSectionLead">
          الهدف ليس زر دفع مبهم؛ الهدف قرار أوضح قبل إعادة التمويل أو طلب منتج
          جديد.
        </p>
        <div className="debtPaymentGrid">
          {plannedCapabilities.map((item) => (
            <article className="debtPaymentCard" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="debtPaymentNotice" aria-label="حدود الميزة القادمة">
        <div>
          <p className="eyebrow">حدود واضحة</p>
          <h2>قريباً، وليس تكاملاً حياً</h2>
        </div>
        <ul>
          {guardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
