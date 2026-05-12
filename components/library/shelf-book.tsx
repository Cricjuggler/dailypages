"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { Bar } from "@/components/ui/bar";
import type { LibraryBook } from "@/lib/types";

export function ShelfBook({
  book,
  delay = 0,
}: {
  book: LibraryBook;
  delay?: number;
}) {
  const router = useRouter();
  const onOpen = () => {
    if (book.id === "meditations") router.push("/reader");
  };

  return (
    <button
      onClick={onOpen}
      className="flex flex-col gap-3.5 text-left animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="grid h-[200px] place-items-end" style={{ justifyItems: "center" }}>
        <BookCover book={book} w={130} h={186} />
      </div>
      <div>
        <div className="font-serif text-[15px] leading-[1.25] text-ink mb-[3px]" style={{ textWrap: "balance" }}>
          {book.title}
        </div>
        <div className="text-[12px] text-ink-2 mb-2">{book.author}</div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  book.status === "Reading"
                    ? "var(--accent)"
                    : book.status === "Finished"
                      ? "var(--ink-3)"
                      : "var(--ink-mute)",
              }}
            />
            {book.status}
          </span>
          <span>{book.lastRead}</span>
        </div>
        {book.progress > 0 && book.progress < 1 && (
          <Bar value={book.progress} className="mt-2" />
        )}
      </div>
    </button>
  );
}
