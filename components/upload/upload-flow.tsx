"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bar } from "@/components/ui/bar";
import { BookCover } from "@/components/book-cover";
import { ArrowLeft, ArrowRight, Check, UploadCloud } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { HAS_BACKEND } from "@/lib/api-config";
import type { BookApi } from "@/lib/api-types";
import { useGetToken } from "@/lib/use-token";

type Stage = "drop" | "processing" | "done" | "failed";

const STEPS = [
  { label: "Reading PDF", hint: "Counting pages" },
  { label: "Extracting structure", hint: "Detecting chapters" },
  { label: "Cleaning prose", hint: "Whitespace, headers, footers" },
  { label: "Persisting chapters", hint: "Writing to database" },
  { label: "Ready to plan", hint: "Done" },
] as const;

const SAMPLE_BOOK = {
  title: "Sapiens",
  author: "Y.N. Harari",
  cover: { hue: 18, sat: 32, dark: 22, light: 90 },
};

function statusToStep(status: BookApi["status"]): number {
  switch (status) {
    case "pending":
      return 0;
    case "parsing":
      return 2;
    case "ready":
      return 4;
    case "failed":
      return 0;
  }
}

function statusToProgress(status: BookApi["status"]): number {
  switch (status) {
    case "pending":
      return 10;
    case "parsing":
      return 60;
    case "ready":
      return 100;
    case "failed":
      return 100;
  }
}

export function UploadFlow() {
  const router = useRouter();
  const getToken = useGetToken();
  const [stage, setStage] = React.useState<Stage>("drop");
  const [progress, setProgress] = React.useState(0);
  const [step, setStep] = React.useState(0);
  const [book, setBook] = React.useState<BookApi | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Mock pipeline (no backend) — preserves the design demo.
  const startMock = React.useCallback(() => {
    setStage("processing");
    setProgress(0);
    setStep(0);
  }, []);

  React.useEffect(() => {
    if (stage !== "processing" || HAS_BACKEND) return;
    let p = 0;
    const id = window.setInterval(() => {
      p += 1.6;
      setProgress(Math.min(100, p));
      setStep(Math.min(STEPS.length - 1, Math.floor(p / 20)));
      if (p >= 100) {
        window.clearInterval(id);
        window.setTimeout(() => setStage("done"), 350);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [stage]);

  // Real pipeline — handles a chosen file end-to-end.
  const handleRealUpload = React.useCallback(
    async (file: File) => {
      // Bail early when the user isn't signed in. Otherwise the API rejects
      // with a 401 that surfaces as a cryptic "Missing bearer token".
      const token = await getToken();
      if (!token) {
        setErrorMessage(
          "Please sign in before uploading. Use the Sign in button in the top-right.",
        );
        setStage("failed");
        return;
      }
      setStage("processing");
      setProgress(5);
      setStep(0);
      setErrorMessage(null);
      try {
        const creds = await api.createUpload(
          {
            title: file.name.replace(/\.(pdf|epub|docx)$/i, ""),
            content_type: file.type || "application/pdf",
            size_bytes: file.size,
          },
          getToken,
        );
        setProgress(25);
        await api.uploadToR2(creds.upload_url, file);
        setProgress(40);
        const queued = await api.processBook(creds.book_id, getToken);
        setBook(queued);
        setProgress(50);

        // Poll for status until ready or failed (max ~3 min).
        const start = Date.now();
        const tick = async (): Promise<void> => {
          if (Date.now() - start > 180_000) {
            throw new Error("Parsing timed out");
          }
          const fresh = await api.getBook(creds.book_id, getToken);
          setBook(fresh);
          setStep(statusToStep(fresh.status));
          setProgress(statusToProgress(fresh.status));
          if (fresh.status === "ready") {
            setStage("done");
            return;
          }
          if (fresh.status === "failed") {
            setErrorMessage(fresh.error_message ?? "Parsing failed");
            setStage("failed");
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
          await tick();
        };
        await tick();
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? `${e.status}: ${e.message}`
            : e instanceof Error
              ? e.message
              : String(e);
        setErrorMessage(msg);
        setStage("failed");
      }
    },
    [getToken],
  );

  return (
    <div className="container-narrow mx-auto w-full max-w-[720px] px-7 pt-[60px] pb-20 animate-fade-up max-md:px-4">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft /> Back
      </Link>

      {stage === "drop" && (
        <DropState
          hasBackend={HAS_BACKEND}
          onMockStart={startMock}
          onRealStart={handleRealUpload}
        />
      )}

      {stage === "processing" && (
        <ProcessingState progress={progress} step={step} book={book} />
      )}

      {stage === "done" && (
        <DoneState
          book={book}
          onContinue={() => {
            if (book && HAS_BACKEND) {
              router.push(`/upload/choose?bookId=${book.id}`);
            } else {
              router.push("/upload/choose");
            }
          }}
        />
      )}

      {stage === "failed" && <FailedState message={errorMessage} onRetry={() => setStage("drop")} />}
    </div>
  );
}

function DropState({
  hasBackend,
  onMockStart,
  onRealStart,
}: {
  hasBackend: boolean;
  onMockStart: () => void;
  onRealStart: (file: File) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (hasBackend) onRealStart(file);
    else onMockStart();
  };

  return (
    <div className="animate-fade-in">
      <div className="eyebrow mb-2.5">Step 1 of 3</div>
      <h1 className="display mb-2.5 text-[36px]">Add a book</h1>
      <p className="mb-8 max-w-[480px] text-[15px] text-ink-2">
        PDF or EPUB — up to 200 MB. We&rsquo;ll keep the author&rsquo;s words; we just rearrange the journey.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.epub,application/pdf,application/epub+zip"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.dataset.hover = "true";
        }}
        onDragLeave={(e) => {
          delete e.currentTarget.dataset.hover;
        }}
        onDrop={(e) => {
          e.preventDefault();
          delete e.currentTarget.dataset.hover;
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className="dropzone block w-full rounded-[18px] border-[1.5px] border-dashed border-line-2 bg-bg-elev px-7 py-14 text-center transition-all duration-200 ease-out hover:border-accent hover:bg-accent-tint data-[hover=true]:border-accent data-[hover=true]:bg-accent-tint"
      >
        <span className="mx-auto mb-4 inline-flex rounded-full border border-line bg-bg p-4 text-accent">
          <UploadCloud size={22} />
        </span>
        <span className="block font-serif text-[20px]">Drop a book here</span>
        <span className="mt-1 block text-[13px] text-ink-2">or click to browse</span>
      </button>

      <div className="mt-4 flex justify-center gap-3 text-[12px] text-ink-3">
        <span>Encrypted upload</span>
        <span>·</span>
        <span>OCR for scans</span>
        <span>·</span>
        <span>Your books stay yours</span>
      </div>

      {!hasBackend && (
        <p className="mt-6 text-center font-serif text-[12px] italic text-ink-3">
          Demo mode — set <code className="font-mono">NEXT_PUBLIC_API_URL</code> +{" "}
          <code className="font-mono">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> to enable real uploads.
        </p>
      )}
    </div>
  );
}

function ProcessingState({
  progress,
  step,
  book,
}: {
  progress: number;
  step: number;
  book: BookApi | null;
}) {
  const titleDisplay = book?.title ?? SAMPLE_BOOK.title;
  const authorDisplay = book?.author ?? SAMPLE_BOOK.author;
  return (
    <div className="animate-fade-in">
      <div className="eyebrow mb-2.5">Step 1 of 3 · Processing</div>
      <h1 className="display mb-2.5 text-[36px]">Reading the book</h1>
      <p className="mb-9 text-[15px] text-ink-2">
        <i>{titleDisplay}</i> — finding chapters, sections, and rhythm.
      </p>

      <Card className="mb-7 px-7 py-7">
        <div className="mb-6 flex items-start gap-4">
          <BookCover book={SAMPLE_BOOK} w={64} h={92} fontScale={0.85} />
          <div className="flex-1">
            <div className="font-serif text-[18px]">{titleDisplay}</div>
            <div className="text-[13px] text-ink-2">{authorDisplay ?? ""}</div>
            <Bar value={progress / 100} className="mt-3.5" />
            <div className="mt-2 flex items-center justify-between text-[11.5px] text-ink-3">
              <span>{STEPS[step].label}…</span>
              <span className="tnum">{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        <hr className="m-0 mb-5 h-px border-0 bg-line" />

        <div className="flex flex-col gap-2.5">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-[13px] transition-opacity duration-300"
              style={{ opacity: i > step ? 0.35 : 1 }}
            >
              <span
                className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                style={{
                  background:
                    i < step
                      ? "var(--accent)"
                      : i === step
                        ? "var(--accent-tint)"
                        : "transparent",
                  border: i >= step ? "1px solid var(--line-2)" : "0",
                  color: i < step ? "#fff" : "var(--accent)",
                }}
              >
                {i < step && <Check size={11} />}
                {i === step && (
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </span>
              <span className="flex-1">{s.label}</span>
              <span className="text-[12px] text-ink-2">{i <= step ? s.hint : ""}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Strip common torrent/repository markers from filename-derived titles.
function cleanTitle(title: string): string {
  return title
    .replace(/\((?:z-lib\.org|libgen\.[a-z]+|annas-archive)[^)]*\)/gi, "")
    .replace(/\bby\s+[\w.\s-]{2,40}$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Derive a deterministic procedural cover from the book id so the donor screen
// matches whatever the Library will eventually show for this book.
function coverFromBook(book: BookApi | null) {
  if (book?.cover_params) return { ...book.cover_params, title: book.title, author: book.author ?? "" };
  const seed = book?.id
    ? book.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    : 0;
  const palettes = [
    { hue: 28, sat: 22, dark: 18, light: 88 },
    { hue: 12, sat: 30, dark: 24, light: 86 },
    { hue: 210, sat: 18, dark: 20, light: 86 },
    { hue: 130, sat: 20, dark: 22, light: 84 },
    { hue: 48, sat: 28, dark: 20, light: 86 },
    { hue: 0, sat: 35, dark: 22, light: 84 },
  ];
  const palette = palettes[seed % palettes.length];
  return { ...palette, title: book?.title ?? "Book", author: book?.author ?? "" };
}

function DoneState({
  book,
  onContinue,
}: {
  book: BookApi | null;
  onContinue: () => void;
}) {
  const rawTitle = book?.title ?? SAMPLE_BOOK.title;
  const title = cleanTitle(rawTitle) || rawTitle;
  const author = book?.author ?? "Unknown";
  const coverBook = coverFromBook(book);
  return (
    <div className="animate-fade-up">
      <div className="eyebrow mb-2.5">Step 1 of 3 · Done</div>
      <h1 className="display mb-2.5 text-[36px]">{title}, ready.</h1>
      <p className="mb-8 text-[15px] text-ink-2">
        Now choose how you&rsquo;d like to read it — as-is, or AI-paced.
      </p>

      <Card className="mb-7 p-6">
        <div className="flex gap-4">
          <BookCover
            book={{ title: coverBook.title, author: coverBook.author, cover: { hue: coverBook.hue, sat: coverBook.sat, dark: coverBook.dark, light: coverBook.light } }}
            w={72}
            h={104}
            fontScale={0.9}
          />
          <div className="flex-1">
            <div className="mb-1 font-serif text-[19px]">{title}</div>
            <div className="mb-3.5 text-[13px] text-ink-2">
              {author} · {book?.pages ?? "—"} pages
            </div>
          </div>
        </div>
      </Card>

      <Button variant="accent" onClick={onContinue}>
        Continue <ArrowRight />
      </Button>
    </div>
  );
}

function FailedState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="animate-fade-up">
      <div className="eyebrow mb-2.5">Upload failed</div>
      <h1 className="display mb-2.5 text-[36px]">Something didn&rsquo;t land.</h1>
      <p className="mb-6 max-w-[480px] text-[15px] text-ink-2">
        {message ?? "Please try again. If the problem persists, the file may be unsupported."}
      </p>
      <Button variant="ghost" onClick={onRetry}>
        Try another file
      </Button>
    </div>
  );
}
