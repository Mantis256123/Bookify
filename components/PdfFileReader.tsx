"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import VapiControls from "./VapiControls";
import { IBook } from "@/types";

type PdfDocumentProxy =
  import("pdfjs-dist/types/src/display/api").PDFDocumentProxy;

type BookSegment = {
  content: string;
  segmentIndex: number;
};

type BookReaderProps = {
  title: string;
  author: string;
  fileURL: string;
  segments: BookSegment[];
  book: IBook;
};

export default function PdfFileReader({
  title,
  author,
  fileURL,
  segments,
  book,
}: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [activePages, setActivePages] = useState<number[]>([1, 2, 3, 4, 5]);
  const [pageSize, setPageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const currentPageRef = useRef(1);
  const viewerRef = useRef<HTMLElement>(null);
  const pdfRef = useRef<PdfDocumentProxy | null>(null);
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const textLayerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const renderedPageNumbers = useRef(new Set<number>());
  const renderingPageNumbers = useRef(new Set<number>());
  const renderTasks = useRef<
    Record<
      number,
      { cancel: () => void; promise: Promise<unknown> } | undefined
    >
  >({});
  const readerCancelled = useRef(false);
  const visiblePageRef = useRef(1);
  const pageCount = pdfPageCount ?? Math.max(segments.length, 1);
  const updateZoom = (amount: number) => {
    setZoom((currentZoom) =>
      Math.min(1.5, Math.max(0.75, Math.round((currentZoom + amount) * 100) / 100)),
    );
  };

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const frame = requestAnimationFrame(() => {
      viewer.scrollLeft = Math.max(0, (viewer.scrollWidth - viewer.clientWidth) / 2);
    });
    return () => cancelAnimationFrame(frame);
  }, [zoom]);

  const setRenderWindow = (page: number) => {
    const totalPages = pdfPageCount ?? pageCount;
    const windowSize = Math.min(5, totalPages);
    const start = Math.max(
      1,
      Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1),
    );
    const nextPages = Array.from(
      { length: windowSize },
      (_, index) => start + index,
    );
    setActivePages((currentPages) =>
      currentPages.length === nextPages.length &&
      currentPages.every((value, index) => value === nextPages[index])
        ? currentPages
        : nextPages,
    );
  };

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), pageCount);
    currentPageRef.current = nextPage;
    visiblePageRef.current = nextPage;
    setRenderWindow(nextPage);
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
    requestAnimationFrame(() => {
      pageRefs.current[nextPage]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      setIsLoadingPage(true);
      setViewerError(null);
      readerCancelled.current = false;

      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const pdf = await pdfjsLib.getDocument({ url: fileURL }).promise;
        if (cancelled) {
          return;
        }

        setPdfPageCount(pdf.numPages);
        setActivePages(
          Array.from(
            { length: Math.min(5, pdf.numPages) },
            (_, index) => index + 1,
          ),
        );
        pdfRef.current = pdf;
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1.35 });
        setPageSize({ width: viewport.width, height: viewport.height });
        firstPage.cleanup();
      } catch {
        if (!cancelled) {
          setPdfPageCount(null);
          pdfRef.current = null;
          setViewerError("This upload is being shown as text.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false);
        }
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
      readerCancelled.current = true;
      Object.values(renderTasks.current).forEach((task) => task?.cancel());
      renderTasks.current = {};
      renderedPageNumbers.current.clear();
      renderingPageNumbers.current.clear();
      pdfRef.current = null;
    };
  }, [fileURL]);

  useEffect(() => {
    let cancelled = false;
    let idleCallback: number | undefined;
    let timeoutId: number | undefined;

    const waitForIdleTime = () =>
      new Promise<void>((resolve) => {
        if (typeof window.requestIdleCallback === "function") {
          idleCallback = window.requestIdleCallback(() => resolve(), {
            timeout: 150,
          });
        } else {
          timeoutId = window.setTimeout(resolve, 16);
        }
      });

    const renderPages = async () => {
      const pdf = pdfRef.current;
      if (!pdf || !pageSize || readerCancelled.current) {
        return;
      }

      const { TextLayerBuilder } =
        await import("pdfjs-dist/web/pdf_viewer.mjs");

      // Render one page at a time. This avoids PDF.js canvas contention and
      // keeps the visible pages ahead of background prefetch work.
      const pageNumbers = [...activePages].sort(
        (first, second) =>
          Math.abs(first - visiblePageRef.current) -
          Math.abs(second - visiblePageRef.current),
      );

      for (const pageNumber of pageNumbers) {
        if (
          cancelled ||
          readerCancelled.current ||
          renderedPageNumbers.current.has(pageNumber)
        ) {
          continue;
        }
        if (renderingPageNumbers.current.has(pageNumber)) {
          continue;
        }

        await waitForIdleTime();
        if (cancelled || readerCancelled.current) {
          break;
        }

        const canvas = canvasRefs.current[pageNumber];
        const container = textLayerRefs.current[pageNumber];
        if (!canvas || !container || readerCancelled.current) {
          continue;
        }

        renderingPageNumbers.current.add(pageNumber);
        let page: Awaited<ReturnType<PdfDocumentProxy["getPage"]>> | null =
          null;
        try {
          page = await pdf.getPage(pageNumber);
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Could not create the page canvas.");
          }

          const renderWidth =
            canvas.parentElement?.clientWidth ?? pageSize.width;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = renderWidth / baseViewport.width;
          const renderViewport = page.getViewport({ scale });
          const outputScale = Math.max(window.devicePixelRatio || 1, 2);

          canvas.width = Math.ceil(renderViewport.width * outputScale);
          canvas.height = Math.ceil(renderViewport.height * outputScale);
          canvas.style.width = `${renderViewport.width}px`;
          canvas.style.height = `${renderViewport.height}px`;
          context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

          const renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport: renderViewport,
          });
          renderTasks.current[pageNumber] = renderTask;
          await renderTask.promise;
          delete renderTasks.current[pageNumber];

          if (
            readerCancelled.current ||
            canvasRefs.current[pageNumber] !== canvas
          ) {
            continue;
          }

          const textLayer = new TextLayerBuilder({ pdfPage: page });
          await textLayer.render({
            viewport: renderViewport,
            images: undefined as never,
          });
          textLayer.div.style.width = `${renderViewport.width}px`;
          textLayer.div.style.height = `${renderViewport.height}px`;
          textLayer.div.style.setProperty(
            "--total-scale-factor",
            String(renderViewport.scale),
          );
          container.replaceChildren(textLayer.div);
          renderedPageNumbers.current.add(pageNumber);
        } catch (error) {
          delete renderTasks.current[pageNumber];
          if (
            !readerCancelled.current &&
            (!(error instanceof Error) ||
              error.name !== "RenderingCancelledException")
          ) {
            console.error(`Failed to render PDF page ${pageNumber}:`, error);
          }
        } finally {
          renderingPageNumbers.current.delete(pageNumber);
          page?.cleanup();
        }
      }
    };

    void renderPages();
    return () => {
      cancelled = true;
      Object.values(renderTasks.current).forEach((task) => task?.cancel());
      renderTasks.current = {};
      renderedPageNumbers.current.clear();
      renderingPageNumbers.current.clear();
      if (
        idleCallback !== undefined &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(idleCallback);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activePages, pdfPageCount, pageSize, zoom]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    let frameId: number | undefined;
    const updateCurrentPage = () => {
      frameId = undefined;
      const viewerBounds = viewer.getBoundingClientRect();
      const center = viewerBounds.top + viewer.clientHeight / 2;
      let closestPage = currentPageRef.current;
      let closestDistance = Number.POSITIVE_INFINITY;

      Object.entries(pageRefs.current).forEach(([pageNumber, element]) => {
        if (!element) return;
        const bounds = element.getBoundingClientRect();
        const distance = Math.abs(bounds.top + bounds.height / 2 - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = Number(pageNumber);
        }
      });

      if (closestPage !== currentPageRef.current) {
        currentPageRef.current = closestPage;
        visiblePageRef.current = closestPage;
        setRenderWindow(closestPage);
        setCurrentPage(closestPage);
        setPageInput(String(closestPage));
      }
    };
    const scheduleUpdate = () => {
      if (frameId === undefined) {
        frameId = requestAnimationFrame(updateCurrentPage);
      }
    };

    viewer.addEventListener("scroll", scheduleUpdate, { passive: true });
    scheduleUpdate();
    return () => {
      viewer.removeEventListener("scroll", scheduleUpdate);
      if (frameId !== undefined) cancelAnimationFrame(frameId);
    };
  }, [pdfPageCount, segments.length]);

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
            disabled={currentPage === 1}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <ChevronUp className="size-5" />
          </button>
          <input
            aria-label="Current page"
            type="number"
            min={1}
            max={pageCount}
            value={pageInput}
            onChange={(event) => {
              const value = event.target.value;
              setPageInput(value);

              if (value !== "") {
                const page = Number(value);
                if (Number.isInteger(page)) {
                  goToPage(page);
                }
              }
            }}
            onBlur={() => {
              const page = Number(pageInput);
              if (!Number.isInteger(page) || page < 1) {
                goToPage(1);
              } else {
                goToPage(page);
              }
            }}
            className="h-9 w-12 rounded-lg border border-[#999] bg-white text-center text-sm font-medium text-[#333] outline-none focus:border-[#663820]"
          />
          <span className="text-sm font-semibold text-[#444]">{pageCount}</span>
          <button
            type="button"
            aria-label="Next page"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === pageCount}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <ChevronDown className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => updateZoom(0.1)}
            disabled={zoom >= 1.5}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <ZoomIn className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => updateZoom(-0.1)}
            disabled={zoom <= 0.75}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <ZoomOut className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            className="rounded-full p-2 text-[#555] hover:bg-[#f3e4c7] disabled:opacity-30"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
        <p className="border-t border-[#eee4d6] pt-4 text-center text-xs leading-5 text-[#777]">
          Use the arrows or enter a page number.
        </p>
      </aside>

      <section
        ref={viewerRef}
        className="min-h-[620px] min-w-0 flex-1 overflow-y-auto rounded-2xl border border-[#eadfce] bg-[#e9dfcf] p-5 shadow-[0_8px_30px_rgba(61,48,34,0.08)] lg:h-[calc(100vh-6rem)]"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-start gap-5">
          {isLoadingPage && pdfPageCount === null && (
            <div className="flex min-h-[calc(100vh-10rem)] items-start pt-8 text-sm text-[#777]">
              Loading document...
            </div>
          )}
          {pdfPageCount !== null &&
            Array.from({ length: pdfPageCount }, (_, index) => index + 1).map(
              (pageNumber) => {
                const isActive = activePages.includes(pageNumber);
                return (
                  <div
                    key={pageNumber}
                    ref={(element) => {
                      pageRefs.current[pageNumber] = element;
                    }}
                    data-page-number={pageNumber}
                    className="relative scroll-mt-5 overflow-hidden rounded-sm bg-white shadow-[0_4px_18px_rgba(61,48,34,0.16)]"
                    style={{
                      width: `${zoom * 100}%`,
                      maxWidth: "none",
                      aspectRatio: pageSize
                        ? `${pageSize.width} / ${pageSize.height}`
                        : undefined,
                    }}
                  >
                    {isActive && (
                      <>
                        <canvas
                          ref={(element) => {
                            canvasRefs.current[pageNumber] = element;
                            if (!element) {
                              renderTasks.current[pageNumber]?.cancel();
                              delete renderTasks.current[pageNumber];
                              renderedPageNumbers.current.delete(pageNumber);
                              renderingPageNumbers.current.delete(pageNumber);
                            }
                          }}
                          aria-label={`Page ${pageNumber} of ${title}`}
                          className="pdf-page-canvas block h-auto w-full"
                        />
                        <div
                          ref={(element) => {
                            textLayerRefs.current[pageNumber] = element;
                          }}
                          aria-label={`Selectable text from page ${pageNumber}`}
                          className="pdf-text-layer"
                        />
                      </>
                    )}
                  </div>
                );
              },
            )}
          {pdfPageCount === null &&
            segments.map((segment, index) => (
              <article
                key={segment.segmentIndex}
                ref={(element) => {
                  pageRefs.current[index + 1] = element;
                }}
                data-page-number={index + 1}
                className="min-h-[680px] scroll-mt-5 rounded-sm bg-white px-8 py-12 shadow-[0_4px_18px_rgba(61,48,34,0.16)] sm:px-14"
                style={{ width: `${zoom * 100}%` }}
              >
                <p className="mb-10 text-center text-xs uppercase tracking-[0.25em] text-[#999]">
                  Page {index + 1}
                </p>
                <p className="whitespace-pre-wrap break-words font-serif text-lg leading-9 text-[#2d2a26]">
                  {segment.content}
                </p>
              </article>
            ))}
          {pdfPageCount === null && segments.length === 0 && !isLoadingPage && (
            <article
              className="min-h-[680px] rounded-sm bg-white px-8 py-12 shadow-[0_4px_18px_rgba(61,48,34,0.16)] sm:px-14"
              style={{ width: `${zoom * 100}%` }}
            >
              <p className="text-center text-[#777]">
                This document does not contain readable text.
              </p>
            </article>
          )}
        </div>
        {viewerError && (
          <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-[#777]">
            {viewerError}
          </p>
        )}
      </section>

      <VapiControls book={book} />
    </main>
  );
}
