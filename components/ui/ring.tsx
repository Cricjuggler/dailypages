import * as React from "react";

type RingProps = {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
};

export function Ring({
  value,
  size = 64,
  stroke = 4,
  label,
  sublabel,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      {label != null && (
        <div className="absolute inset-0 grid place-items-center text-center font-serif leading-none">
          <div>
            <div style={{ fontSize: size * 0.28, color: "var(--ink)" }}>
              {label}
            </div>
            {sublabel && (
              <div className="font-sans text-[9px] mt-0.5 uppercase tracking-[.1em] text-ink-3">
                {sublabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
