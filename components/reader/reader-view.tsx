"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ArrowRight, Clock, CloseIcon, Spark } from "@/components/icons";
import { API_BASE, HAS_BACKEND } from "@/lib/api-config";
import { useGetToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import type { ActiveBook, ProseBlock } from "@/lib/types";

type Props = {
  book: ActiveBook;
  content: ProseBlock[];
  sessionId?: string;
};

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ReaderView({ book, content, sessionId }: Props) {
  const router = useRouter();
  const getToken = useGetToken();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const idleTimer = React.useRef<number | null>(null);

  const [scrollPct, setScrollPct] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [showChrome, setShowChrome] = React.useState(true);
  const [highlights, setHighlights] = React.useState<Set<number>>(new Set());
  const [explain, setExplain] = React.useState<
    { x: number; y: number; idx: number; paragraph: string } | null
  >(null);

  // Track scroll progress on the reading column
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setScrollPct(max > 0 ? el.scrollTop / max : 0);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Reading clock — ticks every second
  React.useEffect(() => {
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-hide chrome after idle
  React.useEffect(() => {
    const reset = () => {
      setShowChrome(true);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setShowChrome(false), 2400);
    };
    reset();
    const el = scrollRef.current;
    el?.addEventListener("scroll", reset, { passive: true });
    el?.addEventListener("mousemove", reset);
    return () => {
      el?.removeEventListener("scroll", reset);
      el?.removeEventListener("mousemove", reset);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, []);

  const togglePara = (idx: number) =>
    setHighlights((s) => {
      const n = new Set(s);
      if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });

  const goalSec = book.todaySession.readingTime * 60;
  const sessionPct = Math.min(1, elapsed / goalSec);

  const onComplete = () => {
    // Quiz/recap dropped — return to the plan so the user can pick the next session.
    router.push("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* Top progress hairline (always visible) */}
      <div className="absolute left-0 right-0 top-0 z-[5] h-0.5 bg-line">
        <div
          className="h-full bg-accent"
          style={{
            width: `${scrollPct * 100}%`,
            transition: "width 200ms linear",
          }}
        />
      </div>

      {/* Top chrome */}
      <div
        className={cn(
          "absolute left-0 right-0 top-0 z-[4] flex items-center justify-between px-7 py-[18px] transition-opacity duration-[380ms] max-md:px-4",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <Button variant="quiet" onClick={() => router.push("/")} className="text-[13px]">
          <CloseIcon size={14} /> Close
        </Button>
        <div className="font-serif text-[13px] italic text-ink-2 max-md:hidden">
          {book.title} · {book.todaySession.chapter}
        </div>
        <span className="flex items-center gap-1 tnum text-[12px] text-ink-3">
          <Clock size={12} /> {fmtTime(elapsed)} / {book.todaySession.readingTime}:00
        </span>
      </div>

      {/* Reading column */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-7 pt-[108px] pb-[200px] max-md:px-4"
        style={{ scrollbarWidth: "thin" }}
        onClick={() => explain && setExplain(null)}
      >
        <div className="reader-prose">
          {content.map((b, i) => (
            <ProseRender
              key={i}
              block={b}
              idx={i}
              highlighted={highlights.has(i)}
              onToggleHighlight={togglePara}
              onContextExplain={(x, y, text) => setExplain({ x, y, idx: i, paragraph: text })}
              onComplete={onComplete}
            />
          ))}
        </div>
      </div>

      {/* Bottom chrome */}
      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 z-[4] flex items-center justify-between px-7 pb-[22px] pt-[18px] transition-opacity duration-[380ms] max-md:px-4",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ background: "linear-gradient(to top, var(--bg) 60%, transparent)" }}
      >
        <span className="tnum text-[12px] text-ink-3">
          {Math.round(scrollPct * 100)}% of session
        </span>
        <div className="h-1 w-[220px] overflow-hidden rounded-full bg-line max-md:w-[140px]">
          <div
            className="h-full rounded-full bg-accent"
            style={{
              width: `${sessionPct * 100}%`,
              transition: "width 1s linear",
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-full px-3 py-2 text-[12px] text-ink-2 hover:text-ink max-md:hidden">
            {highlights.size} highlights
          </button>
          <button
            onClick={onComplete}
            className="rounded-full border border-line-2 bg-transparent px-3.5 py-1.5 text-[12.5px] text-ink hover:bg-bg-elev"
          >
            End session
          </button>
        </div>
      </div>

      {explain && (
        <ExplainBubble
          x={explain.x}
          y={explain.y}
          paragraph={explain.paragraph}
          sessionId={sessionId}
          getToken={getToken}
          onClose={() => setExplain(null)}
        />
      )}
    </div>
  );
}

type ProseRenderProps = {
  block: ProseBlock;
  idx: number;
  highlighted: boolean;
  onToggleHighlight: (idx: number) => void;
  onContextExplain: (x: number, y: number, paragraph: string) => void;
  onComplete: () => void;
};

function ProseRender({
  block,
  idx,
  highlighted,
  onToggleHighlight,
  onContextExplain,
  onComplete,
}: ProseRenderProps) {
  if (block.kind === "intro") {
    return (
      <header className="mb-14 text-center">
        <div className="eyebrow mb-[18px]">{block.eyebrow}</div>
        <h1
          className="display mb-3.5"
          style={{ fontSize: 44, textWrap: "balance" }}
        >
          {block.title}
        </h1>
        <div className="font-serif text-[13.5px] italic text-ink-2">{block.meta}</div>
        <div className="mx-auto my-8 h-px w-10 bg-accent opacity-50" />
      </header>
    );
  }
  if (block.kind === "h2") {
    return <h2 className="font-serif">{block.text}</h2>;
  }
  if (block.kind === "section-mark") {
    return <span className="section-mark">{block.text}</span>;
  }
  if (block.kind === "pullquote") {
    return <blockquote className="pullquote">&ldquo;{block.text}&rdquo;</blockquote>;
  }
  if (block.kind === "p") {
    return (
      <p
        className={cn(block.dropcap && "dropcap")}
        onClick={(e) => {
          // ignore propagation when clicking the bubble overlay
          e.stopPropagation();
          onToggleHighlight(idx);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextExplain(e.clientX, e.clientY, block.text);
        }}
        style={{
          cursor: "text",
          background: highlighted ? "var(--accent-tint)" : "transparent",
          borderRadius: 4,
          padding: highlighted ? "0 4px" : "0",
          margin: highlighted ? "0 -4px 1.4em" : "0 0 1.4em",
          transition: "background 200ms",
        }}
      >
        {block.text}
      </p>
    );
  }
  if (block.kind === "outro") {
    return (
      <div className="mt-14 text-center">
        <div className="eyebrow mb-3.5">End of session</div>
        <Button variant="accent" onClick={onComplete}>
          Done for today <ArrowRight />
        </Button>
      </div>
    );
  }
  return null;
}

const MOCK_EXPLANATION =
  "The “retreat into thyself” is Marcus's image for the disciplined return to one's hēgemonikon — the ruling, reasoning faculty. Under stress, you can shelter in your own principles more reliably than in any external place.";

function ExplainBubble({
  x,
  y,
  paragraph,
  sessionId,
  getToken,
  onClose,
}: {
  x: number;
  y: number;
  paragraph: string;
  sessionId: string | undefined;
  getToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [pos, setPos] = React.useState({ left: x, top: y });
  const [text, setText] = React.useState("");
  const [intent, setIntent] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    setPos({
      left: Math.max(12, Math.min(x, W - 340)),
      top: Math.max(12, Math.min(y, H - 240)),
    });
  }, [x, y]);

  const runStream = React.useCallback(
    async (chosenIntent: string | null) => {
      if (!HAS_BACKEND || !sessionId) {
        setText(MOCK_EXPLANATION);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setError(null);
      setText("");

      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/explain`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ paragraph, intent: chosenIntent ?? undefined }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        // SSE parser — lines starting with "data:" carry chunks.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            for (const line of evt.split("\n")) {
              if (line.startsWith("data: ")) {
                const chunk = line.slice(6).replace(/\\n/g, "\n");
                setText((t) => t + chunk);
              } else if (line.startsWith("event: error")) {
                setError("Stream error");
              }
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
        }
      } finally {
        setStreaming(false);
      }
    },
    [getToken, paragraph, sessionId],
  );

  // Kick off the initial stream when the bubble opens.
  React.useEffect(() => {
    runStream(null);
    return () => abortRef.current?.abort();
    // Run only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIntent = (label: string) => {
    setIntent(label);
    void runStream(label);
  };

  return (
    <>
      <div
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        className="fixed inset-0 z-[80]"
      />
      <div
        className="fixed z-[81] w-[320px] rounded-lg border border-line bg-bg-elev p-[18px] shadow-paper animate-fade-up"
        style={{
          left: pos.left,
          top: pos.top,
          boxShadow: "0 24px 60px -16px rgba(0,0,0,.25)",
        }}
      >
        <div className="mb-3 flex items-center gap-2 text-accent">
          <Spark size={14} />
          <span className="eyebrow text-accent" style={{ color: "var(--accent)" }}>
            {intent ? `Explain · ${intent}` : "Explain"}
          </span>
          {streaming && <span className="ml-auto text-[10.5px] text-ink-3">streaming…</span>}
        </div>
        <p className="mb-3 min-h-[3em] font-serif text-[14px] leading-[1.55] text-ink">
          {error ? <span className="text-ink-3">Couldn&rsquo;t load: {error}</span> : text || (
            <span className="text-ink-3">…</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["More like this", "An example", "Compare to Seneca"] as const).map((label) => (
            <Chip
              key={label}
              className="cursor-pointer"
              onClick={() => handleIntent(label)}
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>
    </>
  );
}
