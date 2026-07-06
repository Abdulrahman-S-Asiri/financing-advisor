import type { Metadata } from "next";
import Link from "next/link";

import AtharLogo from "../components/site/AtharLogo";
import { personas } from "../features/journey/data";
import { formatSar } from "../features/journey/format";

export const metadata: Metadata = {
  description:
    "أثر مستشار تمويل وكيلي يقرأ الوضع المالي، يقارن العروض، ويشرح قرار التمويل بالعربية — عرض تجريبي.",
};

const flow = [
  {
    label: "01",
    title: "نقطة قرار",
    text: "تبدأ الرحلة بطلب تمويل واضح وموافقة صريحة على بيانات مصرفية محاكاة.",
  },
  {
    label: "02",
    title: "أثر مالي",
    text: "المحرك يستخرج الدخل والالتزامات ونسب الملاءة دون نقل الحسابات إلى نموذج لغوي.",
  },
  {
    label: "03",
    title: "تموّج السوق",
    text: "كل عرض يُختبر بالتكلفة والأهلية، ويظل وسم السعر غير المؤكد ظاهراً.",
  },
  {
    label: "04",
    title: "قرار مفسر",
    text: "تحصل على توصية قابلة للمراجعة، وسبب قبول أو رفض، وخطوة تالية محاكاة.",
  },
];

const trustPoints = [
  {
    title: "الأرقام من المحرك",
    text: "كل ريال ونسبة وقسط يأتي من دوال حسابية حتمية مُغطاة بالاختبارات.",
  },
  {
    title: "الذهب للنقطة المهمة فقط",
    text: "هوية أثر تستخدم الذهبي لنقطة القرار والأرقام المفتاحية، لا للزخرفة.",
  },
  {
    title: "حدود العرض واضحة",
    text: "لا توجد موافقة حقيقية أو دفع أو اتصال بحساب بنكي فعلي داخل هذا العرض.",
  },
];

export default function LandingPage() {
  return (
    <main className="sitePage atharHome">
      <section className="atharHero" aria-label="أثر">
        <div className="atharHeroCopy">
          <AtharLogo size="lg" variant="horizontal" />
          <p className="eyebrow">واجهة تمويل وكيلي — عرض تجريبي</p>
          <h1>أثر القرار المالي يبدأ من حقيقة واحدة محسوبة</h1>
          <p className="landingLead">
            أثر يحول بيانات مصرفية محاكاة إلى ملف ملاءة واضح، ثم يطابقه مع
            عروض تمويل إسلامي ويشرح النتيجة بالعربية. النموذج يشرح فقط؛
            المحرك هو من يحسب.
          </p>
          <div className="landingCtaRow">
            <Link className="primaryButton" href="/journey">
              ابدأ رحلة أثر
            </Link>
            <Link className="landingCtaSecondary" href="/docs">
              كيف تُحسب النتائج
            </Link>
          </div>
          <p className="landingHonesty">
            بيانات محاكاة · أسعار غير مؤكدة · لا يُعد عرضاً تمويلياً
          </p>
        </div>

        <aside className="atharDecisionCard" aria-label="ملخص هوية أثر">
          <div className="atharDecisionMark" aria-hidden="true">
            <AtharLogo size="lg" variant="mark" />
          </div>
          <dl>
            <div>
              <dt>العلامة</dt>
              <dd>نقطة قرار وتموّجات أثرها في السوق</dd>
            </div>
            <div>
              <dt>الحساب</dt>
              <dd>محرك حتمي، لا أرقام مولدة</dd>
            </div>
            <div>
              <dt>النتيجة</dt>
              <dd>تفسير واضح لا وعد موافقة</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="landingSection" aria-label="مسار أثر">
        <h2>من نقطة القرار إلى أثرها في كل عرض</h2>
        <p className="landingSectionLead">
          كل خطوة في الرحلة تعرض ما حدث فعلاً: قراءة، حساب، مطابقة، ثم شرح.
        </p>
        <div className="atharFlow">
          {flow.map((step) => (
            <article className="landingStepCard" key={step.label}>
              <span className="atharStepLabel">{step.label}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingSection" aria-label="ثقة وشفافية">
        <h2>هوية مصرفية هادئة، وشفافية غير قابلة للتفاوض</h2>
        <div className="landingTrust">
          {trustPoints.map((point) => (
            <article className="landingTrustCard" key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingSection" aria-label="ميزة قادمة">
        <div className="landingUpcomingCard">
          <div>
            <span className="warningBadge">قريباً</span>
            <h2>سداد المديونية كأثر قبل التمويل الجديد</h2>
            <p>
              ميزة قادمة لمحاكاة أثر سداد الالتزامات الحالية على نسب الملاءة
              والأهلية، دون تنفيذ أي عملية دفع حقيقية.
            </p>
          </div>
          <Link className="landingCtaSecondary" href="/debt-payment">
            تفاصيل الميزة
          </Link>
        </div>
      </section>

      <section className="landingSection" aria-label="شخصيات التجربة">
        <h2>جرّب أثر بثلاث شخصيات جاهزة</h2>
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
          شخصيات ببيانات محاكاة مثبتة — نفس النتائج في كل تشغيل.
        </p>
      </section>

      <section className="landingCtaBand" aria-label="ابدأ الآن">
        <AtharLogo tone="reversed" variant="mark" />
        <h2>شاهد أثر القرار على حالة كاملة</h2>
        <p>من الموافقة إلى التوصية المُفسَّرة في رحلة واحدة.</p>
        <Link className="primaryButton" href="/journey">
          ابدأ رحلة أثر
        </Link>
      </section>
    </main>
  );
}
