"use client";

import { BookOpen, FileText } from "lucide-react";
import { useEffect, useState } from "react";

type BookFileStatsProps = {
  fileURL: string;
};

export default function BookFileStats({ fileURL }: BookFileStatsProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
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
  }, [fileURL]);

  return (
    <div className="flex flex-wrap gap-3 text-sm text-[#3d485e]">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5">
        <BookOpen className="size-4" aria-hidden="true" />
        {pageCount === null ? "Loading pages..." : `${pageCount} pages`}
      </span>
      <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5">
        <FileText className="size-4" aria-hidden="true" />
        PDF file
      </span>
    </div>
  );
}
