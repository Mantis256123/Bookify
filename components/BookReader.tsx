"use client";

import { IBook } from "@/types";
import { useEffect, useState } from "react";
import PdfFileReader from "./PdfFileReader";
import WordFileReader from "./WordFileReader";

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

export default function BookReader(props: BookReaderProps) {
  const [detectedExtension, setDetectedExtension] = useState<string>();
  const extension =
    props.book.fileExtension?.replace(".", "").toLowerCase() ||
    props.fileURL.split(".").pop()?.split("?")[0].toLowerCase();

  useEffect(() => {
    if (props.book.fileExtension || extension === "docx" || extension === "doc") {
      return;
    }

    void fetch(props.fileURL, { method: "HEAD" })
      .then((response) => {
        const contentType = response.headers.get("content-type")?.toLowerCase();
        if (contentType?.includes("wordprocessingml")) {
          setDetectedExtension("docx");
        }
      })
      .catch((error) => {
        console.error("Could not detect uploaded file type:", error);
      });
  }, [extension, props.book.fileExtension, props.fileURL]);

  const resolvedExtension = detectedExtension || extension;

  if (resolvedExtension === "docx" || resolvedExtension === "doc") {
    return <WordFileReader {...props} />;
  }

  return <PdfFileReader {...props} />;
}
