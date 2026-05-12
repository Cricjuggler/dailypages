import * as React from "react";
import type { BookCoverInfo } from "@/lib/types";

type Props = {
  book: BookCoverInfo;
  w?: number;
  h?: number;
  showSpine?: boolean;
  fontScale?: number;
};

export function BookCover({
  book,
  w = 96,
  h = 140,
  showSpine = true,
  fontScale = 1,
}: Props) {
  const { hue, sat, dark, light } = book.cover;
  const bg = `hsl(${hue} ${sat}% ${dark}%)`;
  const bg2 = `hsl(${hue} ${Math.max(8, sat - 10)}% ${Math.max(10, dark - 6)}%)`;
  const fg = `hsl(${hue} ${Math.min(35, sat + 10)}% ${light}%)`;
  const accent = `hsl(${hue} ${sat}% ${Math.min(75, light - 10)}%)`;
  const titleSize = w < 80 ? 9.5 : w < 110 ? 11 : 13;
  const small = w < 70;

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: w,
        height: h,
        background: `linear-gradient(135deg, ${bg} 0%, ${bg2} 100%)`,
        borderRadius: "1px 4px 4px 1px",
        boxShadow: showSpine
          ? "inset 6px 0 12px -6px rgba(0,0,0,.5), 2px 4px 14px -4px rgba(40,28,12,.45)"
          : "2px 4px 14px -4px rgba(40,28,12,.45)",
      }}
    >
      {/* Cloth texture */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px)",
        }}
      />
      {/* Frame */}
      <div
        className="absolute"
        style={{
          inset: small ? 6 : 10,
          border: `0.5px solid ${fg}`,
          opacity: 0.3,
          borderRadius: 1,
        }}
      />
      {/* Top accent rule */}
      <div
        className="absolute h-px opacity-50"
        style={{
          left: small ? 10 : 14,
          right: small ? 10 : 14,
          top: small ? 14 : 18,
          background: accent,
        }}
      />
      {/* Title + author */}
      <div
        className="absolute flex flex-col justify-between"
        style={{
          inset: `${small ? 14 : 20}px ${small ? 10 : 14}px`,
          color: fg,
          fontFamily: "var(--serif)",
        }}
      >
        <div
          style={{
            fontSize: titleSize * fontScale,
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: "-.005em",
            textWrap: "balance",
          }}
        >
          {book.title}
        </div>
        <div
          style={{
            fontSize: (small ? 7 : 8.5) * fontScale,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            opacity: 0.7,
            fontFamily: "var(--sans)",
            fontWeight: 500,
          }}
        >
          {book.author}
        </div>
      </div>
    </div>
  );
}
