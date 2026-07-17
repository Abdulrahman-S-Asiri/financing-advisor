# Demo Checklist — Financing Advisor

Run through this before any demo or screenshot session.

## Pre-demo verification (10 minutes)

- [ ] `.\scripts\check.ps1` — backend, MCP, frontend lint/typecheck/unit/build all green.
- [ ] `.\scripts\dev.ps1` — three services running (mock OB :8100, API :8000, frontend :3000).
- [ ] `/status` shows: service card green, LLM provider **مفعل** (if chat is
      part of the demo), Open Banking = mock.
- [ ] Expected and honest: rate verification shows **0/8** and "جاهز للعرض
      العام: غير مفعل" until the data-review pass lands — know the one-line
      answer for it (see DEMO_SCRIPT.md).
- [ ] Hard-refresh the browser (Ctrl+Shift+R); close DevTools; hide bookmarks
      bar; 100% zoom.
- [ ] Rehearse the three personas once — numbers must match the script
      (Sara: salary 18,000 / headroom 6,000).

## Screenshots checklist

Take at desktop width (~1280px) unless marked mobile. Every shot that shows
an offer must have the **سعر غير مؤكد** badge visible — no cropping it out.

| # | Route / state | Must be visible |
|---|---|---|
| 1 | `/` hero | Title, honesty strip, demo pill in nav |
| 2 | `/` how-it-works | The four diamond step cards |
| 3 | `/` trust section | The three transparency cards |
| 4 | `/journey` (Discover) | Persona cards + consent checkbox + form |
| 5 | `/journey` mid-run (Define) | Live agent timeline while events stream — screenshot fast or re-run |
| 6 | Define dashboard | Salary/income/headroom metric cards + the three DBR gauges |
| 7 | Develop (Sara) | Ranked offer grid, status + unverified badges |
| 8 | Develop (Khalid) | All-rejected grid, one card's reason + near-miss line legible |
| 9 | Simulator flip (Khalid) | Before/after amounts with statuses changed |
| 10 | Compare panel | 3 offers side-by-side, Arabic structure labels (تورق/مرابحة) |
| 11 | Deliver (Ahmed) | Recommendation card + next steps with the التحقق link |
| 12 | Advisor chat | A streamed Arabic answer to a suggested question |
| 13 | Chat fallback (if reproducible) | The amber رد آمن bubble with its badge |
| 14 | Application tracker | Progress stepper + محاكاة badge + status timeline |
| 15 | Offer detail | Cost breakdown + DBR trace + schedule rows + source link |
| 16 | `/status` | Honest 0/8 verification card + green service card |
| 17 | `/docs` | The limitations section (حدود العرض التجريبي) |
| 18 | Mobile `/` (375px) | Hamburger nav + hero stacking |
| 19 | Mobile `/journey` | Stage rail collapsed to horizontal, form usable |
| 20 | 404 page | Any bad URL → Arabic not-found with recovery links |

## After changes, before re-demoing

- [ ] Re-run the verification block above.
- [ ] Re-check screenshots #6 and #8 — engine numbers are the demo's spine;
      if any changed unexpectedly, stop and find out why before presenting.
