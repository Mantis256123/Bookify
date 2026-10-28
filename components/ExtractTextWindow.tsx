"use client";

import {
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { useState } from "react";

import ExtractionBlocks, {
  type ExtractionElement,
} from "@/components/ExtractionBlocks";

type OutputView = "rendered" | "blocks" | "markdown";

type ExtractionResult = {
  markdown: string;
  output: {
    elements?: ExtractionElement[];
    languageDetection?: {
      pages?: Array<{ languages?: string[] }>;
    };
    [key: string]: unknown;
  };
};

type ImageBounds = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

function splitIntoBlocks(markdown: string) {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default function ExtractTextWindow() {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [view, setView] = useState<OutputView>("rendered");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [hoveredElementId, setHoveredElementId] = useState<number | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile);
    setError("");
    setResult(null);
    setImageSize({ width: 0, height: 0 });
    if (nextFile && nextFile?.size > 1 * 1024 * 1024) {
      setError("File size exceeds 1MB limit.");
      return;
    }
    if (nextFile?.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(nextFile));
    } else {
      setFilePreview("");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a PDF, Word, or image file first.");
      return;
    }
    if (file === currentFile) {
      return;
    }
    setIsSubmitting(true);
    setCurrentFile(file);
    setLoadingStep(0);
    setError("");
    setResult(null);
    setCopiedKey(null);
    const loadingTimer = window.setInterval(
      () => setLoadingStep((step) => (step + 1) % 3),
      900,
    );

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/extract-text", {
        method: "POST",
        body: form,
      });
      const responseResult = await response.json();

      if (!response.ok) {
        throw new Error(responseResult.error || "Text extraction failed.");
      }

      setResult(responseResult as ExtractionResult);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Text extraction failed.",
      );
    } finally {
      window.clearInterval(loadingTimer);
      setIsSubmitting(false);
    }
  };

  const blocks = result ? splitIntoBlocks(result.markdown) : [];
  const elements = result?.output.elements ?? [];
  const language =
    result?.output.languageDetection?.pages?.[0]?.languages?.[0] ?? "Unknown";

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl bg-[#f3e4c7] p-6 sm:p-8">
      <h1 className="font-serif text-3xl font-bold text-[#212a3b]">
        Extract text
      </h1>
      <p className="mt-2 text-[#3d485e]">
        Upload a photo or file and extract its text.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <label className="upload-dropzone !h-auto min-h-[165px] overflow-visible border-2 border-dashed border-[#d8cdbd] bg-white px-4 py-6">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(event) =>
              handleFileChange(event.target.files?.[0] ?? null)
            }
          />
          {file ? (
            <>
              {filePreview ? (
                <div className="relative inline-block max-w-full overflow-visible">
                  <img
                    src={filePreview}
                    alt="Selected image preview"
                    className="block h-auto max-w-full rounded object-contain"
                    onLoad={(event) => {
                      setImageSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                    }}
                  />
                  {result &&
                    imageSize.width > 0 &&
                    imageSize.height > 0 &&
                    result.output.elements?.map((element, index) => {
                      const bounds = element.bounds as ImageBounds | undefined;
                      if (
                        !bounds ||
                        typeof bounds.x !== "number" ||
                        typeof bounds.y !== "number" ||
                        typeof bounds.width !== "number" ||
                        typeof bounds.height !== "number"
                      ) {
                        return null;
                      }

                      return (
                        <div
                          key={index}
                          aria-label={`Detected element ${index + 1}`}
                          className="pointer-events-none absolute border-2 border-[#587bc0] bg-[#7da9ce23] hover:bg-[#7daacecb]"
                          onMouseEnter={() => {
                            setHoveredElementId(index);
                          }}
                          style={{
                            left: `${(bounds.x / imageSize.width) * 100}%`,
                            top: `${(bounds.y / imageSize.height) * 100}%`,
                            width: `${(bounds.width / imageSize.width) * 100}%`,
                            height: `${(bounds.height / imageSize.height) * 100}%`,
                          }}
                        />
                      );
                    })}
                </div>
              ) : (
                <FileText className="upload-dropzone-icon" aria-hidden="true" />
              )}
              <span className="upload-dropzone-text text-base">
                {file.name}
              </span>
            </>
          ) : (
            <>
              <ImageIcon className="upload-dropzone-icon" aria-hidden="true" />
              <span className="upload-dropzone-text">
                Click to choose a file
              </span>
            </>
          )}
          <span className="upload-dropzone-hint">PDF, Word, or image file</span>
        </label>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" className="form-btn" disabled={isSubmitting}>
          {isSubmitting ? "Extracting..." : "Extract text"}
        </button>
      </form>

      {isSubmitting && (
        <div
          className="mt-5 flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-[#3d485e]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin text-[#663820]" />
          <span>
            {
              [
                "Preparing file...",
                "Reading document...",
                "Structuring text...",
              ][loadingStep]
            }
          </span>
        </div>
      )}

      {result && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#212a3b]">
                Extracted text
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#212a3b]">
                {blocks.length} blocks
                {elements.length > 0 &&
                  `, ${elements.length} source elements`}{" "}
                · Language: {language}
              </p>
            </div>
            <div className="flex rounded-lg bg-white p-1" role="tablist">
              {(["rendered", "blocks", "markdown"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={view === option}
                  onClick={() => setView(option)}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                    view === option
                      ? "bg-[#663820] !text-white"
                      : "text-[#3d485e] hover:bg-[#f3e4c7]"
                  }`}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-white p-4">
            {view === "rendered" && (
              <div>
                <article className="relative rounded-lg border border-[#d8cdbd] bg-[#f8f4e9] p-4">
                  <div className="mb-2 pr-12 text-xs font-semibold uppercase tracking-wide text-[#8b7355]">
                    RESULT
                  </div>
                  <button
                    type="button"
                    aria-label="Copy result"
                    onClick={() => copyToClipboard(result.markdown, "result")}
                    className="absolute right-3 top-3 inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-[#3d485e] hover:bg-[#e8d8ba]"
                  >
                    {copiedKey === "result" ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                  <p className="whitespace-pre-wrap leading-6 text-[#212a3b]">
                    {result.markdown}
                  </p>
                </article>
              </div>
            )}

            {view === "blocks" && (
              <ExtractionBlocks
                blocks={blocks}
                elements={elements}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
                hoveredElementId={hoveredElementId}
              />
            )}

            {view === "markdown" && (
              <pre className="whitespace-pre-wrap text-sm leading-6 text-[#212a3b]">
                {result.markdown}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
