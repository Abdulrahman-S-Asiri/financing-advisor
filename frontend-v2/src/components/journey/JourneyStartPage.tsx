"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { JourneyShell } from "@/components/journey/StageNav";
import { Badge, Button, Card, ErrorState, SectionHeading } from "@/components/ui";
import { findPersona, personas, type Persona, type PersonaId } from "@/lib/data";
import { formatNumber, formatSar } from "@/lib/format";
import { strings } from "@/lib/strings";
import { useJourneyStore } from "@/stores/journey";

type FieldErrors = Partial<Record<"amount" | "tenor" | "age" | "consent", string>>;

const amountLimits = { min: 5_000, max: 2_000_000, step: 1_000 };
const tenorLimits = { min: 6, max: 60, step: 6 };
const ageLimits = { min: 18, max: 65 };

function isStepAligned(value: number, min: number, step: number): boolean {
  return (value - min) % step === 0;
}

function validate({
  amount,
  tenor,
  age,
  consent,
}: {
  amount: number;
  tenor: number;
  age: number;
  consent: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (
    !Number.isFinite(amount) ||
    amount < amountLimits.min ||
    amount > amountLimits.max ||
    !isStepAligned(amount, amountLimits.min, amountLimits.step)
  ) {
    errors.amount = strings.journey.amountInvalid;
  }

  if (
    !Number.isFinite(tenor) ||
    tenor < tenorLimits.min ||
    tenor > tenorLimits.max ||
    !isStepAligned(tenor, tenorLimits.min, tenorLimits.step)
  ) {
    errors.tenor = strings.journey.tenorInvalid;
  }

  if (!Number.isFinite(age) || age < ageLimits.min || age > ageLimits.max) {
    errors.age = strings.journey.ageInvalid;
  }

  if (!consent) {
    errors.consent = strings.journey.consentRequired;
  }

  return errors;
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function PersonaButton({
  persona,
  selected,
  onSelect,
}: {
  persona: Persona;
  selected: boolean;
  onSelect: (persona: Persona) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(persona)}
      className={`rounded-2xl border p-4 text-start transition-colors ${
        selected
          ? "border-accent bg-surface-soft shadow-athar"
          : "border-line bg-surface hover:border-accent"
      }`}
    >
      <span className="flex items-start justify-between gap-4">
        <span>
          <strong className="block text-xl font-black text-ink">{persona.name}</strong>
          <span className="mt-1 block text-sm font-bold text-accent">{persona.label}</span>
        </span>
        <span className="grid size-10 place-items-center rounded-xl bg-background font-mono text-sm font-bold text-brand">
          {formatNumber(persona.age)}
        </span>
      </span>
      <span className="mt-3 block text-sm leading-7 text-muted">{persona.summary}</span>
      <span className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-muted">
        <span className="rounded-full bg-background px-3 py-1">
          {formatSar(persona.amount)}
        </span>
        <span className="rounded-full bg-background px-3 py-1">
          {formatNumber(persona.tenor)} شهر
        </span>
      </span>
    </button>
  );
}

function ErrorLine({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-2 text-xs font-bold text-danger">
      {message}
    </p>
  );
}

export function JourneyStartPage({ initialPersonaId }: { initialPersonaId?: string }) {
  const router = useRouter();
  const initialPersona = useMemo(
    () => findPersona(initialPersonaId) ?? personas[0],
    [initialPersonaId],
  );
  const [selectedPersona, setSelectedPersona] = useState(initialPersona);
  const [amount, setAmount] = useState(initialPersona.amount);
  const [tenor, setTenor] = useState(initialPersona.tenor);
  const [age, setAge] = useState(initialPersona.age);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const running = useJourneyStore((state) => state.running);
  const journeyError = useJourneyStore((state) => state.journeyError);
  const runJourney = useJourneyStore((state) => state.runJourney);

  const busy = running || submitting;

  function applyPersona(persona: Persona) {
    setSelectedPersona(persona);
    setAmount(persona.amount);
    setTenor(persona.tenor);
    setAge(persona.age);
    setErrors({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submittingRef.current) {
      return;
    }

    const nextErrors = validate({ amount, tenor, age, consent });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const ok = await runJourney({
      personaId: selectedPersona.id as PersonaId,
      amount,
      tenor,
      age,
    });
    submittingRef.current = false;
    setSubmitting(false);

    if (ok) {
      router.push("/journey/analysis");
    }
  }

  return (
    <JourneyShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
        <section>
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-bold text-accent">{strings.landing.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black text-ink md:text-4xl">
              {strings.journey.startTitle}
            </h1>
            <p className="mt-3 text-base leading-8 text-muted">
              {strings.journey.startText}
            </p>
          </div>

          <Card>
            <SectionHeading
              title={strings.journey.consentTitle}
              trailing={<Badge tone="accent">{strings.common.simulation}</Badge>}
            />
            <div aria-label={strings.journey.personasAria} className="grid gap-3 md:grid-cols-3">
              {personas.map((persona) => (
                <PersonaButton
                  key={persona.id}
                  persona={persona}
                  selected={persona.id === selectedPersona.id}
                  onSelect={applyPersona}
                />
              ))}
            </div>
          </Card>
        </section>

        <Card className="self-start">
          <form noValidate onSubmit={submit}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-accent">{strings.journey.requestEyebrow}</p>
                <h2 className="text-xl font-black text-ink">{strings.journey.requestTitle}</h2>
              </div>
              <Badge tone="warn">{strings.common.demo}</Badge>
            </div>

            <div className="grid gap-4">
              <div>
                <label htmlFor="amount" className="text-sm font-bold text-ink">
                  {strings.journey.amountLabel}
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  inputMode="numeric"
                  min={amountLimits.min}
                  max={amountLimits.max}
                  step={amountLimits.step}
                  value={amount}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={errors.amount ? "amount-error" : "amount-hint"}
                  onChange={(event) => {
                    setAmount(numericValue(event.currentTarget.value, amount));
                    setErrors((current) => ({ ...current, amount: undefined }));
                  }}
                  className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 text-base font-bold text-ink outline-none transition-colors focus:border-accent"
                />
                <p id="amount-hint" className="mt-2 text-xs text-muted">
                  {strings.journey.amountHint}
                </p>
                <ErrorLine id="amount-error" message={errors.amount} />
              </div>

              <div>
                <label htmlFor="tenor" className="text-sm font-bold text-ink">
                  {strings.journey.tenorLabel}
                </label>
                <input
                  id="tenor"
                  name="tenor"
                  type="number"
                  inputMode="numeric"
                  min={tenorLimits.min}
                  max={tenorLimits.max}
                  step={tenorLimits.step}
                  value={tenor}
                  aria-invalid={Boolean(errors.tenor)}
                  aria-describedby={errors.tenor ? "tenor-error" : "tenor-hint"}
                  onChange={(event) => {
                    setTenor(numericValue(event.currentTarget.value, tenor));
                    setErrors((current) => ({ ...current, tenor: undefined }));
                  }}
                  className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 text-base font-bold text-ink outline-none transition-colors focus:border-accent"
                />
                <p id="tenor-hint" className="mt-2 text-xs text-muted">
                  {strings.journey.tenorHint}
                </p>
                <ErrorLine id="tenor-error" message={errors.tenor} />
              </div>

              <div>
                <label htmlFor="age" className="text-sm font-bold text-ink">
                  {strings.journey.ageLabel}
                </label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  inputMode="numeric"
                  min={ageLimits.min}
                  max={ageLimits.max}
                  value={age}
                  aria-invalid={Boolean(errors.age)}
                  aria-describedby={errors.age ? "age-error" : "age-hint"}
                  onChange={(event) => {
                    setAge(numericValue(event.currentTarget.value, age));
                    setErrors((current) => ({ ...current, age: undefined }));
                  }}
                  className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 text-base font-bold text-ink outline-none transition-colors focus:border-accent"
                />
                <p id="age-hint" className="mt-2 text-xs text-muted">
                  {strings.journey.ageHint}
                </p>
                <ErrorLine id="age-error" message={errors.age} />
              </div>

              <div className="rounded-xl border border-line bg-background p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="journey-consent"
                    name="journeyConsent"
                    type="checkbox"
                    checked={consent}
                    aria-invalid={Boolean(errors.consent)}
                    aria-describedby={errors.consent ? "consent-error" : undefined}
                    onChange={(event) => {
                      setConsent(event.currentTarget.checked);
                      setErrors((current) => ({ ...current, consent: undefined }));
                    }}
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <label htmlFor="journey-consent" className="text-sm font-bold text-ink">
                    {strings.journey.consentLabel}
                  </label>
                </div>
                <ErrorLine id="consent-error" message={errors.consent} />
              </div>

              {journeyError && <ErrorState message={journeyError} />}

              <Button type="submit" loading={busy} disabled={busy}>
                {busy ? strings.journey.submitting : strings.journey.submit}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </JourneyShell>
  );
}
