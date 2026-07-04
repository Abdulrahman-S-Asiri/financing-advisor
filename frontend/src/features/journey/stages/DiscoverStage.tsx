import type { FormEvent } from "react";

import { personas } from "../data";
import type { Persona } from "../types";

export type DiscoverStageProps = {
  age: number;
  consent: boolean;
  isLoading: boolean;
  journeyError: string;
  requestedAmount: number;
  requestedTenor: number;
  selectedPersona: Persona;
  onAgeChange: (value: number) => void;
  onAmountChange: (value: number) => void;
  onConsentChange: (value: boolean) => void;
  onPersonaChange: (persona: Persona) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTenorChange: (value: number) => void;
};

export default function DiscoverStage({
  age,
  consent,
  isLoading,
  journeyError,
  requestedAmount,
  requestedTenor,
  selectedPersona,
  onAgeChange,
  onAmountChange,
  onConsentChange,
  onPersonaChange,
  onSubmit,
  onTenorChange,
}: DiscoverStageProps) {
  return (
    <div className="stageContent">
      <section className="personaGrid" aria-label="الشخصيات التجريبية">
        {personas.map((persona) => (
          <button
            key={persona.id}
            type="button"
            className={`personaCard ${selectedPersona.id === persona.id ? "personaSelected" : ""}`}
            onClick={() => onPersonaChange(persona)}
          >
            <span>{persona.label}</span>
            <strong>{persona.name}</strong>
            <p>{persona.summary}</p>
          </button>
        ))}
      </section>

      <form className="requestPanel" onSubmit={onSubmit}>
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Discover</p>
            <h3>طلب التمويل</h3>
          </div>
          <span className="connectionPill">Live API</span>
        </div>

        <div className="formGrid">
          <label>
            <span>مبلغ التمويل</span>
            <input
              min={5000}
              step={1000}
              type="number"
              value={requestedAmount}
              onChange={(event) => onAmountChange(Number(event.target.value))}
            />
          </label>
          <label>
            <span>مدة التمويل بالأشهر</span>
            <input
              max={60}
              min={6}
              step={6}
              type="number"
              value={requestedTenor}
              onChange={(event) => onTenorChange(Number(event.target.value))}
            />
          </label>
          <label>
            <span>العمر</span>
            <input
              max={65}
              min={18}
              type="number"
              value={age}
              onChange={(event) => onAgeChange(Number(event.target.value))}
            />
          </label>
        </div>

        <label className="consentRow">
          <input
            checked={consent}
            type="checkbox"
            onChange={(event) => onConsentChange(event.target.checked)}
          />
          <span>موافقة مشاركة بيانات الحساب التجريبية</span>
        </label>

        {journeyError && <p className="errorBanner">{journeyError}</p>}

        <button className="primaryButton" disabled={!consent || isLoading} type="submit">
          {isLoading ? "جاري التحليل..." : "ابدأ تحليل التمويل"}
        </button>
      </form>
    </div>
  );
}
