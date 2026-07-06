import { expect, test, type Page } from "@playwright/test";

const labels = {
  consent: "موافقة مشاركة بيانات الحساب التجريبية",
  startAnalysis: "ابدأ تحليل التمويل",
  analysisTitle: "تحليل القدرة المالية",
  offersTitle: "العروض المرتبة",
  continueToOffers: "عرض العروض المرتبة",
  continueToDecision: "الانتقال للقرار",
  chooseOffer: "اختيار عرض للتقديم",
  prepareDraft: "جهز الطلب المختار",
  submitApplication: "إرسال المحاكاة",
  advanceApplication: "تحديث الحالة",
  detailsLink: "عرض التفاصيل",
  detailBack: "العودة للعروض",
  scheduleTitle: "جدول السداد الشهري",
  statusTitle: "الحالة",
  refresh: "تحديث",
};

async function clearPersistedJourney(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
}

async function startJourney(page: Page, personaId: string) {
  await page.goto(`/journey?persona=${personaId}`);
  await page.getByLabel(labels.consent).check();

  await Promise.all([
    page.waitForURL("**/journey/analysis", { timeout: 60_000 }),
    page.getByRole("button", { name: labels.startAnalysis }).click(),
  ]);

  await expect(page.getByRole("heading", { name: labels.analysisTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: labels.continueToOffers })).toBeVisible();
}

async function openOffers(page: Page) {
  await page.getByRole("link", { name: labels.continueToOffers }).click();
  await expect(page).toHaveURL(/\/journey\/offers$/);
  await expect(page.getByRole("heading", { name: labels.offersTitle, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: labels.detailsLink }).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await clearPersistedJourney(page);
});

test("سارة تعرض مساحة قسط ٦٬٠٠٠ بوضوح", async ({ page }) => {
  await startJourney(page, "sara_strong");

  await expect(page.getByText("القسط الجديد المتاح")).toBeVisible();
  await expect(page.getByText(/٦٬٠٠٠|6,000/).first()).toBeVisible();
});

test("خالد يعرض رفض كل العروض مع أقرب مسار ممكن", async ({ page }) => {
  await startJourney(page, "khalid_rejected");
  await openOffers(page);

  const offerCards = page.locator("article").filter({
    has: page.getByRole("link", { name: labels.detailsLink }),
  });
  const cardCount = await offerCards.count();
  expect(cardCount).toBeGreaterThan(0);

  for (let index = 0; index < cardCount; index += 1) {
    await expect(offerCards.nth(index).getByText("غير مؤهل")).toBeVisible();
  }

  await expect(page.getByText("المسار الأقرب قبل إعادة المحاكاة")).toBeVisible();
});

test("أحمد يكمل الطلب التجريبي حتى حالة نهائية", async ({ page }) => {
  await startJourney(page, "ahmed_borderline");
  await openOffers(page);

  await page.getByRole("link", { name: labels.continueToDecision }).click();
  await expect(page).toHaveURL(/\/journey\/decision$/);

  const chooser = page.getByRole("group", { name: labels.chooseOffer });
  await chooser.getByRole("button").first().click();
  await page.getByRole("button", { name: labels.prepareDraft }).click();
  await expect(page.getByText("مسودة").first()).toBeVisible();

  await page.getByRole("button", { name: labels.submitApplication }).click();
  await expect(page.getByText("مرسل").first()).toBeVisible();

  await page.getByRole("button", { name: labels.advanceApplication }).click();
  await expect(page.getByText("تحت المراجعة").first()).toBeVisible();

  await page.getByRole("button", { name: labels.advanceApplication }).click();
  await expect(page.getByText(/تمت الموافقة في المحاكاة|تم رفض الطلب في المحاكاة/)).toBeVisible();
  await expect(page.getByRole("button", { name: labels.advanceApplication })).toHaveCount(0);
});

test("تفاصيل العرض تعود للعروض دون فقدان حالة الرحلة", async ({ page }) => {
  await startJourney(page, "sara_strong");
  await openOffers(page);

  await page.getByRole("link", { name: labels.detailsLink }).first().click();
  await expect(page).toHaveURL(/\/journeys\/[^/]+\/offers\/[^/]+$/);
  await expect(page.getByRole("heading", { name: labels.scheduleTitle })).toBeVisible();

  await page.getByRole("link", { name: labels.detailBack }).click();
  await expect(page).toHaveURL(/\/journey\/offers$/);
  await expect(page.getByRole("heading", { name: labels.offersTitle, level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: labels.offersTitle, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: labels.detailsLink }).first()).toBeVisible();
});

test("صفحة الحالة تعرض صحة الخدمات ونسبة تحقق العروض", async ({ page }) => {
  await page.goto("/status");

  await expect(page.getByRole("heading", { name: labels.statusTitle })).toBeVisible();
  await expect(page.getByText("الخدمة")).toBeVisible();
  await expect(page.getByText("الحسابات المفتوحة")).toBeVisible();
  await expect(page.getByText("نشاط الجلسة")).toBeVisible();
  await expect(page.getByText("0 / 8")).toBeVisible();

  await page.getByRole("button", { name: labels.refresh }).click();
  await expect(page.getByText("آخر تحديث")).toBeVisible();
});
