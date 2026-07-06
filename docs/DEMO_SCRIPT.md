# Demo Script — Financing Advisor

Target length: **6–7 minutes**. Everything is seeded and deterministic — the
same clicks produce the same numbers every run. Rehearse once end-to-end
before any audience.

## Setup (before the audience arrives)

```powershell
# Terminal 1
.venv\Scripts\python.exe -m uvicorn mock_open_banking.main:app --port 8100
# Terminal 2
.venv\Scripts\python.exe -m uvicorn api.main:app --port 8000
# Terminal 3
cd frontend-v2; npm run dev
```

Open http://127.0.0.1:3001 and http://127.0.0.1:3001/status in two tabs.
Confirm the status page shows the service card green. Advisor chat needs
`ANTHROPIC_API_KEY` in `.env` — verify "مزود النموذج اللغوي: مفعل" on /status.

---

## Act 1 — Landing (30 seconds)

Open `/`. Point at three things, top to bottom:

1. **The one-liner:** "قرار تمويلك، محسوب بدقة ومُفسَّر بالعربية" — an advisor
   that does the work, not a comparison table.
2. **The honesty strip** under the CTA: simulated bank data, unverified
   prices, not a financing offer. *Say it before anyone asks — transparency
   is the product.*
3. **The trust cards:** "الأرقام من المحرك، لا من النموذج" — every number
   comes from deterministic tested code; the language model only explains.

## Act 2 — The strong file: Sara (90 seconds)

Click persona card **سارة — ملف قوي** (jumps to /journey with her data
pre-filled: 60,000 SAR / 36 months / age 31).

1. Point at the consent screen: framed like a real open-banking consent.
   Click **ابدأ تحليل التمويل**.
2. **The signature moment:** agent events stream live in Arabic — profile
   agent, matching agent, cost agent. *"كل حدث هنا يقابل استدعاء حقيقياً في
   المحرك — لا يوجد تقدم وهمي."*
3. Dashboard lands: salary **18,000**, tier **15k–25k**, new-installment
   headroom **6,000** (exactly one-third of gross salary — the salary-linked
   cap). Point at the three DBR gauges vs their caps.
4. Open **طوّر**: ranked offers, each with the **سعر غير مؤكد** badge.
   *"الوسم لا يختفي — لن نعرض سعراً كأنه حقيقي وهو غير مراجع."*

## Act 3 — The strongest beat: Khalid's explained rejection (2 minutes)

Go back to `/` (or nav → الرئيسية) and click **خالد — رفض مفسر**.

1. Run the journey. The dashboard shows obligations already consuming his
   salary (salary 6,000, existing installments 2,600).
2. Offers stage: **everything rejected — but every card says exactly why**
   (which SAMA cap breaks, by how much) **and what would flip it** (the
   near-miss line: lower amount / shorter tenor / salary transfer).
3. **The interactive proof:** in the simulator, lower the amount toward the
   near-miss suggestion and click **تشغيل المحاكاة** — watch offers flip
   status live. *"هذا هو الفرق: رفض قابل للنقاش بدلاً من رفض صامت."*

## Act 4 — Advisor + simulated application (90 seconds)

Switch to **أحمد — حالة حدية** for a mixed result (3 eligible / 5 rejected),
then open **سلّم**:

1. The recommendation card with the cheapest actionable path.
2. Click a **suggested question** (generated from his actual results) and
   send. The reply streams; every number in it exists in the engine output —
   if the model ever slips, a visibly-marked **رد آمن** bubble appears
   instead. *Mention it even if it doesn't trigger; it's an enforced
   invariant, not a slide.*
3. Application: pick the offer → **جهز الطلب المختار** → **إرسال المحاكاة** →
   **تحديث الحالة** twice. Point at the **محاكاة** badge and the status
   timeline. *"التقديم الحقيقي يحتاج اتفاقيات مع الممولين — هذا مقعده في
   المنتج."*
4. Click **عرض التفاصيل** on the recommended offer: full cost breakdown,
   eligibility trace, month-by-month schedule, source link.

## Act 5 — Close on transparency (30 seconds)

Open `/status`: *"حتى صفحة الحالة صادقة — صفر من ثمانية عروض مؤكدة اليوم،
والمنصة نفسها تقول إنها غير جاهزة للعرض العام حتى تكتمل المراجعة."* Then
`/docs` for one beat: the limitations are written down, not hidden.

**Closing line:** *"المحرك يحسب، النموذج يشرح، وكل شيء غير مؤكد موسوم.
هذه هي الأرضية التي تُبنى عليها منصة مرخصة."*

---

## If something goes wrong

| Problem | Recovery |
|---|---|
| Chat returns the amber "needs a provider key" message | Skip Act 4 chat, show the suggested questions instead, keep moving — everything else is offline-deterministic |
| Journey stalls / server hiccup | Re-run the same persona — seeded data means identical results; `/status` tells you which service is down and the exact restart command |
| Accidentally clicked a nav link mid-journey | Use the stage navigation or browser back — v2 keeps the journey in session storage, including offers and decision state |
| Question: "are these real bank rates?" | "لا — placeholder موسومة، والتحقق مهمة مراجعة بيانات قبل أي عرض عام" and show /status |
