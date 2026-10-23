"use client";

import {
  BookOpen,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import VapiControls from "./VapiControls";
import { IBook } from "@/types";

type PdfPageViewport =
  import("pdfjs-dist/types/src/display/page_viewport").PageViewport;
type PdfPageProxy = import("pdfjs-dist/types/src/display/api").PDFPageProxy;

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

type RenderedPage = {
  pageNumber: number;
  page: PdfPageProxy;
  viewport: PdfPageViewport;
};

export default function BookReader({
  title,
  author,
  fileURL,
  segments,
  book,
}: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const textLayerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pageCount = pdfPageCount ?? Math.max(segments.length, 1);

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), pageCount);
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
        const pages: RenderedPage[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.35 });
          pages.push({
            pageNumber,
            page,
            viewport,
          });

          if (cancelled) {
            return;
          }
        }

        setRenderedPages(pages);
      } catch {
        if (!cancelled) {
          setPdfPageCount(null);
          setRenderedPages([]);
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
    };
  }, [fileURL]);

  useEffect(() => {
    let cancelled = false;
    const renderPages = async () => {
      const { TextLayerBuilder } =
        await import("pdfjs-dist/web/pdf_viewer.mjs");

      await Promise.all(
        renderedPages.map(async (page) => {
          const canvas = canvasRefs.current[page.pageNumber];
          const container = textLayerRefs.current[page.pageNumber];
          if (!canvas || !container || cancelled) {
            return;
          }

          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Could not create the page canvas.");
          }

          const renderWidth =
            canvas.parentElement?.clientWidth ?? page.viewport.width;
          const renderViewport = page.viewport.clone({
            scale: page.viewport.scale * (renderWidth / page.viewport.width),
          });
          const outputScale = Math.max(window.devicePixelRatio || 1, 2);
          canvas.width = Math.floor(renderViewport.width * outputScale);
          canvas.height = Math.floor(renderViewport.height * outputScale);
          canvas.style.width = `${renderViewport.width}px`;
          canvas.style.height = `${renderViewport.height}px`;
          context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

          await page.page.render({
            canvas,
            canvasContext: context,
            viewport: renderViewport,
          }).promise;

          container.replaceChildren();
          const textLayer = new TextLayerBuilder({
            pdfPage: page.page,
          });
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
          container.append(textLayer.div);
        }),
      );
    };

    if (renderedPages.length > 0) {
      void renderPages();
    }

    return () => {
      cancelled = true;
    };
  }, [renderedPages]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visiblePage = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visiblePage) {
          const page = Number(
            (visiblePage.target as HTMLElement).dataset.pageNumber,
          );
          if (page) {
            setCurrentPage(page);
            setPageInput(String(page));
          }
        }
      },
      { root: viewer, threshold: [0.5, 0.75] },
    );

    Object.values(pageRefs.current).forEach((page) => {
      if (page) {
        observer.observe(page);
      }
    });

    return () => observer.disconnect();
  }, [renderedPages.length, segments.length]);

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
        </div>
        <p className="border-t border-[#eee4d6] pt-4 text-center text-xs leading-5 text-[#777]">
          Use the arrows or enter a page number.
        </p>
      </aside>

      <section
        ref={viewerRef}
        className="min-h-[620px] min-w-0 flex-1 overflow-y-auto rounded-2xl border border-[#eadfce] bg-[#e9dfcf] p-5 shadow-[0_8px_30px_rgba(61,48,34,0.08)] lg:h-[calc(100vh-6rem)]"
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-start gap-5">
          {isLoadingPage && renderedPages.length === 0 && (
            <div className="flex min-h-[calc(100vh-10rem)] items-start pt-8 text-sm text-[#777]">
              Loading document...
            </div>
          )}
          {renderedPages.map((page) => (
            <div
              key={page.pageNumber}
              ref={(element) => {
                pageRefs.current[page.pageNumber] = element;
              }}
              data-page-number={page.pageNumber}
              className="relative w-full max-w-2xl scroll-mt-5 overflow-hidden rounded-sm bg-white shadow-[0_4px_18px_rgba(61,48,34,0.16)]"
            >
              <canvas
                ref={(element) => {
                  canvasRefs.current[page.pageNumber] = element;
                }}
                aria-label={`Page ${page.pageNumber} of ${title}`}
                className="pdf-page-canvas block h-auto w-full"
              />
              <div
                ref={(element) => {
                  textLayerRefs.current[page.pageNumber] = element;
                }}
                aria-label={`Selectable text from page ${page.pageNumber}`}
                className="pdf-text-layer"
              />
            </div>
          ))}
          {renderedPages.length === 0 &&
            segments.map((segment, index) => (
              <article
                key={segment.segmentIndex}
                ref={(element) => {
                  pageRefs.current[index + 1] = element;
                }}
                data-page-number={index + 1}
                className="min-h-[680px] w-full max-w-2xl scroll-mt-5 rounded-sm bg-white px-8 py-12 shadow-[0_4px_18px_rgba(61,48,34,0.16)] sm:px-14"
              >
                <p className="mb-10 text-center text-xs uppercase tracking-[0.25em] text-[#999]">
                  Page {index + 1}
                </p>
                <p className="whitespace-pre-wrap font-serif text-lg leading-9 text-[#2d2a26]">
                  {segment.content}
                </p>
              </article>
            ))}
          {renderedPages.length === 0 &&
            segments.length === 0 &&
            !isLoadingPage && (
              <article className="min-h-[680px] w-full max-w-2xl rounded-sm bg-white px-8 py-12 shadow-[0_4px_18px_rgba(61,48,34,0.16)] sm:px-14">
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
