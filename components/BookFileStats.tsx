"use client";

import { BookOpen, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { renderAsync } from "docx-preview";

type BookFileStatsProps = {
  fileURL: string;
  fileExtension?: string;
};

export default function BookFileStats({
  fileURL,
  fileExtension,
}: BookFileStatsProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [detectedExtension, setDetectedExtension] = useState<string>();
  const normalizedExtension = (
    fileExtension || detectedExtension
  )?.replace(".", "").toUpperCase();
  const displayedPageCount =
    normalizedExtension === "TXT" ||
    (normalizedExtension && normalizedExtension !== "PDF" && normalizedExtension !== "DOCX")
      ? 1
      : pageCount;

  useEffect(() => {
    if (!fileExtension) {
      void fetch(fileURL, { method: "HEAD" })
        .then((response) => {
          const contentType = response.headers.get("content-type")?.toLowerCase();
          if (contentType?.includes("wordprocessingml")) {
            setDetectedExtension("docx");
          } else if (contentType?.includes("msword")) {
            setDetectedExtension("doc");
          } else if (contentType?.includes("text/plain")) {
            setDetectedExtension("txt");
          }
        })
        .catch((error) => {
          console.error("Could not detect uploaded file type:", error);
        });
    }

    if (normalizedExtension === "DOCX") {
      let cancelled = false;
      const loadWordPageCount = async () => {
        try {
          const response = await fetch(fileURL);
          const container = document.createElement("div");
          await renderAsync(await response.arrayBuffer(), container, undefined, {
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            inWrapper: true,
          });
          const count = container.querySelectorAll(".docx").length;
          if (!cancelled) setPageCount(Math.max(count, 1));
        } catch (error) {
          console.error("Could not count Word document pages:", error);
          if (!cancelled) setPageCount(null);
        }
      };
      void loadWordPageCount();
      return () => {
        cancelled = true;
      };
    }

    if (
      normalizedExtension &&
      normalizedExtension !== "PDF" &&
      normalizedExtension !== "DOCX"
    ) {
      return;
    }

    let cancelled = false;

    const loadPageCount = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const pdf = await pdfjsLib.getDocument({ url: fileURL }).promise;
        if (!cancelled) {
          setPageCount(pdf.numPages);
        }
      } catch {
        if (!cancelled) {
          setPageCount(null);
        }
      }
    };

    void loadPageCount();

    return () => {
      cancelled = true;
    };
  }, [fileExtension, fileURL, normalizedExtension]);

  return (
    <div className="flex flex-wrap gap-3 text-sm text-[#3d485e]">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5">
        <BookOpen className="size-4" aria-hidden="true" />
        {displayedPageCount === null
          ? "Loading pages..."
          : `${displayedPageCount} ${
              displayedPageCount === 1 ? "page" : "pages"
            }`}
      </span>
      <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5">
        <FileText className="size-4" aria-hidden="true" />
        {normalizedExtension
          ? `${normalizedExtension} file`
          : "PDF file"}
      </span>
    </div>
  );
}
