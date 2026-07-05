import type { Metadata } from "next";
import Link from "next/link";

import { personas } from "../features/journey/data";
import { formatSar } from "../features/journey/format";

export const metadata: Metadata = {
  description:
    "مستشار تمويل وكيلي يقرأ الوضع المالي، يطبق قواعد الملاءة، يقارن العروض، ويشرح كل قرار بالعربية — عرض تجريبي.",
};

const steps = [
  {
    label: "اكتشف",
    what: "ربط بيانات بنكية محاكاة بموافقة صريحة وتحديد مبلغ ومدة التمويل.",
    sees: "شاشة موافقة بنمط الخدمات المصرفية المفتوحة وثلاث شخصيات جاهزة للتجربة.",
  },
  {
    label: "حدد",
    what: "وكيل الملف المالي يستخرج الراتب والالتزامات ويحسب نسب الملاءة.",
    sees: "أحداث مباشرة بالعربية لكل خطوة، ومؤشرات نسب الاستقطاع مقابل الحدود.",
  },
  {
    label: "طوّر",
    what: "وكيلا المطابقة والتكلفة يختبران كل عرض ويسعّرانه بمعدل النسبة الفعلي.",
    sees: "عروض مرتبة بأسبابها، محاكي ماذا-لو، ومقارنة جنباً إلى جنب.",
  },
  {
    label: "سلّم",
    what: "توصية مُفسَّرة، مستشار محادثة مقيد بأرقام المحرك، وتقديم محاكى.",
    sees: "سبب التوصية، إجابات ما-الذي-يتغير، ومتتبع حالة الطلب التجريبي.",
  },
];

export default function LandingPage() {
  return (
    <main className="sitePage">
      <section className="landingHero">
        <p className="eyebrow">مستشار تمويل وكيلي — عرض تجريبي</p>
        <h1>قرار تمويلك، محسوب بدقة ومُفسَّر بالعربية</h1>
        <p className="landingLead">
          يقرأ وضعك المالي من بيانات بنكية (محاكاة)، يطبق قواعد الملاءة
          للأفراد بحسابات حتمية مُختبرة، يقارن هياكل التمويل الإسلامي بتكلفتها
          الحقيقية، ويشرح كل قبول وكل رفض — بدلاً من جدول مقارنة صامت.
        </p>
        <div className="landingCtaRow">
          <Link className="primaryButton" href="/journey">
            ابدأ الرحلة التجريبية
          </Link>
          <Link className="landingCtaSecondary" href="/docs">
            كيف يعمل
          </Link>
        </div>
        <p className="landingHonesty">
          بيانات بنكية محاكاة · أسعار العروض غير مؤكدة · لا يُعد عرضاً تمويلياً
        </p>
      </section>

      <section className="landingSection" aria-label="كيف تعمل الرحلة">
        <h2>أربع مراحل، وكلاء يعملون أمامك</h2>
        <p className="landingSectionLead">
          كل حدث يظهر على الشاشة يقابل استدعاء حقيقياً في المحرك — لا يوجد
          تقدم وهمي.
        </p>
        <div className="landingSteps">
          {steps.map((step, index) => (
            <article className="landingStepCard" key={step.label}>
              <span className="landingStepDiamond" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{step.label}</h3>
              <p>{step.what}</p>
              <p>{step.sees}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingSection" aria-label="الشفافية">
        <h2>الشفافية هي المنتج</h2>
        <div className="landingTrust">
          <article className="landingTrustCard">
            <h3>الأرقام من المحرك، لا من النموذج</h3>
            <p>
              كل ريال ونسبة وقسط يأتي من دوال حسابية حتمية مُغطاة بالاختبارات.
              النموذج اللغوي يشرح النتائج فقط، ويمنعه حارس رقمي من ذكر أي رقم
              لم يحسبه المحرك — وإن تعذر ذلك يظهر رد آمن معلَّم بوضوح.
            </p>
          </article>
          <article className="landingTrustCard">
            <h3>شفافية الأسعار</h3>
            <p>
              أسعار العروض الحالية بيانات مبدئية تحمل وسم «سعر غير مؤكد» حتى
              تُراجع من صفحات الجهات الرسمية، والوسم لا يختفي في أي شاشة.{" "}
              <Link href="/status">تابع نسبة التحقق الحالية</Link>.
            </p>
          </article>
          <article className="landingTrustCard">
            <h3>الرفض مُفسَّر، لا مخفي</h3>
            <p>
              كل عرض غير مؤهل يعرض السبب الدقيق: أي حد تجاوزته وبكم، وما أقل
              تغيير يقلب النتيجة — مبلغ أقل، مدة أقصر، أو تحويل راتب.
            </p>
          </article>
        </div>
      </section>

      <section className="landingSection" aria-label="ميزة قادمة">
        <div className="landingUpcomingCard">
          <div>
            <span className="warningBadge">قريباً</span>
            <h2>سداد المديونية قبل التمويل الجديد</h2>
            <p>
              ميزة قادمة لمحاكاة أثر سداد الالتزامات الحالية على نسب الملاءة
              والأهلية، مع بقاء كل الحسابات داخل المحرك الحتمي ودون تنفيذ أي
              عملية دفع حقيقية.
            </p>
          </div>
          <Link className="landingCtaSecondary" href="/debt-payment">
            تفاصيل الميزة
          </Link>
        </div>
      </section>

      <section className="landingSection" aria-label="شخصيات التجربة">
        <h2>جرّب بثلاث شخصيات جاهزة</h2>
        <div className="landingPersonas">
          {personas.map((persona) => (
            <Link
              className="landingPersonaCard"
              key={persona.id}
              href={`/journey?persona=${persona.id}`}
            >
              <h3>
                {persona.name} — {persona.label}
              </h3>
              <p>{persona.summary}</p>
              <span className="landingPersonaMeta">
                <span>{formatSar(persona.amount)}</span>
                <span>{persona.tenor} شهر</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="landingCaption">
          شخصيات ببيانات محاكاة مثبتة — نفس النتائج في كل تشغيل، وهو ما يجعل
          العرض قابلاً للتكرار أمام أي جمهور.
        </p>
      </section>

      <section className="landingCtaBand" aria-label="ابدأ الآن">
        <h2>شاهد الوكلاء يعملون على حالة حقيقية البنية</h2>
        <p>من الموافقة إلى التوصية المُفسَّرة في أقل من دقيقة.</p>
        <Link className="primaryButton" href="/journey">
          ابدأ الرحلة التجريبية
        </Link>
      </section>
    </main>
  );
}
