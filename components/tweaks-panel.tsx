"use client";

import * as React from "react";
import { ACCENT_OPTIONS, usePrefs } from "@/lib/prefs-store";
import { cn } from "@/lib/utils";

/**
 * Floating preferences panel — right-side, collapsible.
 * Mirrors the prototype's `tweaks-panel` but ships as a real user preference UI.
 */
export function TweaksPanel() {
  const [open, setOpen] = React.useState(false);
  const prefs = usePrefs();

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Reading preferences"
        className="fixed bottom-5 right-5 z-30 grid h-10 w-10 place-items-center rounded-full border border-line bg-bg-elev text-ink-2 shadow-paper transition-colors hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      <aside
        aria-hidden={!open}
        className={cn(
          "fixed right-5 bottom-20 z-30 w-[300px] rounded-lg border border-line bg-bg-elev p-5 shadow-paper transition-all duration-200 ease-out",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <div className="mb-1 font-serif text-[15px] text-ink">Tweaks</div>
        <div className="mb-5 text-[12px] text-ink-3">Saved across sessions</div>

        <Section label="Theme" />
        <Radio
          value={prefs.theme}
          options={[
            { value: "paper", label: "Paper" },
            { value: "sepia", label: "Sepia" },
            { value: "dark", label: "Dark" },
          ]}
          onChange={(v) => prefs.setTheme(v as typeof prefs.theme)}
        />
        <SwatchRow value={prefs.accent} options={ACCENT_OPTIONS} onChange={prefs.setAccent} />

        <Section label="Typography" />
        <Radio
          value={prefs.font}
          options={[
            { value: "serif", label: "Serif" },
            { value: "sans", label: "Sans" },
            { value: "mono", label: "Mono" },
          ]}
          onChange={(v) => prefs.setFont(v as typeof prefs.font)}
        />
        <Slider
          label="Reader size"
          value={prefs.readerSize}
          min={15}
          max={26}
          step={1}
          unit="px"
          onChange={prefs.setReaderSize}
        />

        <Section label="Session" />
        <Slider
          label="Minutes per session"
          value={prefs.sessionMinutes}
          min={5}
          max={45}
          step={1}
          unit="min"
          onChange={prefs.setSessionMinutes}
        />
      </aside>
    </>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="mt-4 mb-2 text-[10.5px] font-medium uppercase tracking-[.14em] text-ink-3">
      {label}
    </div>
  );
}

function Radio({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1 rounded-md border border-line bg-bg p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[6px] py-1.5 text-[12.5px] transition-colors",
            value === o.value ? "bg-bg-elev text-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SwatchRow({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-between rounded-md border border-line bg-bg p-2">
      <span className="text-[12px] text-ink-2">Accent</span>
      <div className="flex gap-1.5">
        {options.map((c) => (
          <button
            key={c}
            aria-label={`Accent ${c}`}
            onClick={() => onChange(c)}
            className={cn(
              "h-5 w-5 rounded-full border transition-transform",
              value === c ? "scale-110 border-ink" : "border-line-2",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-2 rounded-md border border-line bg-bg p-3">
      <div className="mb-2 flex items-center justify-between text-[12px] text-ink-2">
        <span>{label}</span>
        <span className="tnum text-ink">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--accent)" }}
      />
    </div>
  );
}
