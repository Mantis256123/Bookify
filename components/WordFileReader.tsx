"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

import { IBook } from "@/types";
import VapiControls from "./VapiControls";

type WordFileReaderProps = {
  title: string;
  author: string;
  book: IBook;
};

export default function WordFileReader({
  title,
  author,
  book,
}: WordFileReaderProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<HTMLElement[]>([]);
  const currentPageRef = useRef(1);

  // fitZoom: automatic scale so the page fits the panel width
  // userScale: what the zoom buttons change (1 = "fit to width")
  const [fitZoom, setFitZoom] = useState(1);
  const [userScale, setUserScale] = useState(1);
  const zoom = fitZoom * userScale;

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 1.5;

  const updateZoom = (amount: number) => {
    setUserScale((current) =>
      Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, Math.round((current + amount) * 100) / 100),
      ),
    );
  };

  const fitToWidth = useCallback(() => {
    const viewer = viewerRef.current;
    const container = documentRef.current;
    const page = container?.querySelector<HTMLElement>(".docx");
    if (!viewer || !container || !page) return;

    // measure the page at its real size, then put the zoom back
    const previousZoom = container.style.zoom;
    container.style.zoom = "1";
    const naturalWidth = page.getBoundingClientRect().width;
    container.style.zoom = previousZoom;

    const available = viewer.clientWidth - 48; // 24px breathing room per side
    if (!naturalWidth || available <= 0) return;

    setFitZoom(Math.min(1.5, Math.max(0.3, available / naturalWidth)));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(book.fileURL);
        if (!response.ok) {
          throw new Error(
            `Could not load the Word document (${response.status}).`,
          );
        }

        const container = documentRef.current;
        if (!container) return;
        container.replaceChildren();

        await renderAsync(await response.arrayBuffer(), container, undefined, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          ignoreWidth: false,
          ignoreHeight: false,
          useBase64URL: true,
          experimental: true,
        });

        if (cancelled) return;

        pageRefs.current = [
          ...Array.from(container.querySelectorAll<HTMLElement>(".docx")),
        ];
        const renderedPageCount = pageRefs.current.length;
        setPageCount(Math.max(renderedPageCount, 1));
        currentPageRef.current = 1;
        setCurrentPage(1);
        setPageInput("1");

        fitToWidth(); // pages exist now, so we can measure them
      } catch (loadError) {
        console.error("Failed to render Word document:", loadError);
        if (!cancelled) {
          setPageCount(null);
          setError("This Word document could not be rendered.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadDocument();
    const document = documentRef.current;
    return () => {
      cancelled = true;
      document?.replaceChildren();
      pageRefs.current = [];
    };
  }, [book.fileURL, fitToWidth]);

  // Re-fit when the panel size changes (window resize, chat sidebar toggling)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const observer = new ResizeObserver(() => fitToWidth());
    observer.observe(viewer);
    return () => observer.disconnect();
  }, [fitToWidth]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const updateCurrentPage = () => {
      const center =
        viewer.getBoundingClientRect().top + viewer.clientHeight / 2;
      let closestPage = 1;
      let closestDistance = Number.POSITIVE_INFINITY;

      pageRefs.current.forEach((page, index) => {
        const bounds = page.getBoundingClientRect();
        const distance = Math.abs(bounds.top + bounds.height / 2 - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = index + 1;
        }
      });

      if (closestPage !== currentPageRef.current) {
        currentPageRef.current = closestPage;
        setCurrentPage(closestPage);
        setPageInput(String(closestPage));
      }
    };

    viewer.addEventListener("scroll", updateCurrentPage, { passive: true });
    return () => viewer.removeEventListener("scroll", updateCurrentPage);
  }, []);

  const goToPage = (page: number) => {
    const totalPages = pageCount ?? 1;
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    currentPageRef.current = nextPage;
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
    pageRefs.current[nextPage - 1]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1600px] flex-col gap-4 px-4 pb-2 pt-20 lg:flex-row lg:gap-5">
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-[#eadfce] bg-white p-4 shadow-[0_8px_30px_rgba(61,48,34,0.06)] lg:sticky lg:top-20 lg:h-fit lg:self-start lg:w-52">
        <div className="mb-4 flex items-center gap-2 border-b border-[#eee4d6] pb-4">
          <BookOpen className="size-5 text-[#8b5e34]" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#212a3b]">{title}</p>
            <p className="truncate text-xs text-[#777]">{author}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 py-5 lg:flex-col lg:gap-2">
          <button
            type="button"
            aria-label="Previous page"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <ChevronUp className="size-5" />
          </button>
          <input
            aria-label="Current page"
            type="number"
            min={1}
            max={pageCount ?? 1}
            value={pageInput}
            onChange={(event) => {
              setPageInput(event.target.value);
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value > 0) goToPage(value);
            }}
            onBlur={() => goToPage(Number(pageInput) || 1)}
            className="h-9 w-12 rounded-lg border border-[#999] bg-white text-center text-sm font-medium text-[#333] outline-none focus:border-[#663820]"
          />
          <span className="text-sm font-semibold text-[#444]">
            {pageCount === null ? "…" : pageCount}
          </span>
          <button
            type="button"
            aria-label="Next page"
            onClick={() => goToPage(currentPage + 1)}
            disabled={pageCount === null || currentPage >= pageCount}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <ChevronDown className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => updateZoom(0.1)}
            disabled={userScale >= MAX_SCALE}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <ZoomIn className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => updateZoom(-0.1)}
            disabled={userScale <= MIN_SCALE}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <ZoomOut className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={() => setUserScale(1)}
            disabled={userScale === 1}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </aside>

      <section
        ref={viewerRef}
        className="min-h-[620px] min-w-0 flex-1 overflow-auto rounded-2xl border border-[#eadfce] bg-[#e9dfcf] shadow-[0_8px_30px_rgba(61,48,34,0.08)] lg:h-[calc(100vh-6rem)]"
      >
        {isLoading && (
          <p className="py-8 text-center text-sm text-[#777]">
            Loading document...
          </p>
        )}
        <div
          ref={documentRef}
          className="docx-reader w-max min-w-full"
          style={{ zoom }}
        />
        {error && (
          <p className="py-8 text-center text-xs text-[#777]">{error}</p>
        )}
      </section>

      <VapiControls book={book} />
    </main>
  );
}
