"use client";

import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteBook } from "@/lib/actions/book.actions";

type DeleteBookButtonProps = {
  bookId: string;
  title: string;
  variant?: "floating" | "menu";
  showTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function DeleteBookButton({
  bookId,
  title,
  variant = "floating",
  showTrigger = true,
  open,
  onOpenChange,
}: DeleteBookButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isOpen = open ?? internalOpen;

  const setIsOpen = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteBook(bookId);
      if (!result.success) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Could not delete this book.",
        );
        return;
      }

      toast.success("Book deleted.");
      router.push("/");
      router.refresh();
    });
  };

  return (
    <>
      {showTrigger && (
        <button
          type="button"
          aria-label={`Delete ${title}`}
          onClick={() => setIsOpen(true)}
          className={
            variant === "menu"
              ? "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-600"
              : "absolute right-4 top-4 inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-[#eadfce] bg-white/80 text-[#8b3f2f] transition-colors hover:bg-[#f8e4dc] hover:text-[#6f2d21] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b3f2f]"
          }
        >
          <Trash2 className="size-5" aria-hidden="true" />
          {variant === "menu" && <span>Delete</span>}
        </button>
      )}

      {isOpen &&
          typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#212a3b]/45 px-4"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isPending) {
                  setIsOpen(false);
                }
              }}
            >
              <section
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-book-title"
                aria-describedby="delete-book-description"
                className="w-full max-w-md rounded-2xl border border-[#eadfce] bg-[#fffdf9] p-6 shadow-[0_18px_60px_rgba(61,48,34,0.2)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f8e4dc] text-[#8b3f2f]">
                    <AlertTriangle className="size-5" aria-hidden="true" />
                  </div>
                  <button
                    type="button"
                    aria-label="Close delete confirmation"
                    onClick={() => setIsOpen(false)}
                    disabled={isPending}
                    className="cursor-pointer rounded-full p-1.5 text-[#777] transition-colors hover:bg-[#f3e4c7] hover:text-[#212a3b] disabled:opacity-40"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>
                <h2
                  id="delete-book-title"
                  className="mt-5 font-serif text-2xl font-bold text-[#212a3b]"
                >
                  Delete this book?
                </h2>
                <p
                  id="delete-book-description"
                  className="mt-2 text-sm leading-6 text-[#3d485e]"
                >
                  “{title}” and its uploaded document, cover image, and saved text
                  will be permanently deleted.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isPending}
                    className="cursor-pointer rounded-lg border border-[#d8cbb9] px-4 py-2.5 text-sm font-semibold text-[#3d485e] transition-colors hover:bg-[#f3e4c7] disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#8b3f2f] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#6f2d21] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending && <Loader2 className="size-4 animate-spin" />}
                    {isPending ? "Deleting..." : "Delete book"}
                  </button>
                </div>
              </section>
            </div>,
          document.body,
        )}
    </>
  );
}
