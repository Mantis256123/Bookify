"use client";

import { Check, Copy } from "lucide-react";

export type ExtractionElement = {
  id?: string | number;
  type?: string;
  text?: string;
  content?: string;
  confidence?: number;
  pageNumber?: number;
  pageIndex?: number;
  bounds?: { width?: number; height?: number; x?: number; y?: number };
  [key: string]: unknown;
};

type ExtractionBlocksProps = {
  blocks: string[];
  elements: ExtractionElement[];
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  hoveredElementId?: number | null;
};

function getElementText(element: ExtractionElement) {
  return element.text || element.content || "";
}

function getBlockType(block: string) {
  const firstLine = block.split("\n")[0].trim();
  if (firstLine.startsWith("#")) return "Heading";
  if (firstLine.startsWith(">")) return "Quote";
  if (firstLine.startsWith("- ") || firstLine.startsWith("* ")) return "List";
  if (firstLine.startsWith("|")) return "Table";
  return "Paragraph";
}

export function renderMarkdownBlock(block: string, index: number) {
  const lines = block.split("\n");
  const firstLine = lines[0].trim();
  const body = lines.slice(1).join("\n");

  if (firstLine.startsWith("#")) {
    return (
      <h3 key={index} className="font-serif text-xl font-bold text-[#212a3b]">
        {firstLine.replace(/^#+\s*/, "")}
      </h3>
    );
  }

  if (lines.every((line) => line.startsWith("- ") || line.startsWith("* "))) {
    return (
      <ul key={index} className="list-disc space-y-1 pl-5 text-[#212a3b]">
        {lines.map((line) => (
          <li key={line}>{line.slice(2)}</li>
        ))}
      </ul>
    );
  }

  if (firstLine.startsWith(">")) {
    return (
      <blockquote
        key={index}
        className="border-l-4 border-[#d8cdbd] pl-4 italic leading-7 text-[#3d485e]"
      >
        {block
          .split("\n")
          .map((line) => line.replace(/^>\s?/, ""))
          .join("\n")}
      </blockquote>
    );
  }

  return (
    <p key={index} className="whitespace-pre-wrap leading-7 text-[#212a3b]">
      {body ? `${firstLine}\n${body}` : firstLine}
    </p>
  );
}

export default function ExtractionBlocks({
  blocks,
  elements,
  copiedKey,
  onCopy,
  hoveredElementId,
}: ExtractionBlocksProps) {
  return (
    <div className="space-y-3">
      {elements.length > 0
        ? elements.map((element, index) => {
            const text = getElementText(element);
            return (
              <article
                key={element.id ?? index}
                className={`relative rounded-lg border ${hoveredElementId === index ? "border-[#5b8a30]" : "border-[#d8cdbd]"} bg-[#f8f4e9] p-4`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 pr-12 text-xs font-semibold uppercase tracking-wide text-[#8b7355]">
                  <span>Block {index + 1}</span>
                  <span>·</span>
                  <span>{element.type || "Text"}</span>
                  {typeof element.pageNumber === "number" && (
                    <span>· Page {element.pageNumber}</span>
                  )}
                  {typeof element.confidence === "number" && (
                    <span className="inline-flex items-center gap-1 text-[#3d485e]">
                      <span className="flex size-3 items-center justify-center rounded-full bg-green-500 text-[8px] font-bold leading-none text-white">
                        •
                      </span>
                      {Math.round(element.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Copy block ${index + 1}`}
                  onClick={() => onCopy(text, `block-${index}`)}
                  className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm text-[#3d485e] hover:bg-[#e8d8ba]"
                >
                  {copiedKey === `block-${index}` ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
                <p className="whitespace-pre-wrap leading-7 text-[#212a3b]">
                  {text || "No text returned for this element."}
                </p>
              </article>
            );
          })
        : blocks.map((block, index) => (
            <article
              key={index}
              className="relative rounded-lg border border-[#d8cdbd] bg-[#f8f4e9] p-4"
            >
              <div className="mb-2 pr-12 text-xs font-semibold uppercase tracking-wide text-[#8b7355]">
                Block {index + 1} · {getBlockType(block)}
              </div>
              <button
                type="button"
                aria-label={`Copy block ${index + 1}`}
                onClick={() => onCopy(block, `block-${index}`)}
                className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm text-[#3d485e] hover:bg-[#e8d8ba]"
              >
                {copiedKey === `block-${index}` ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
              {renderMarkdownBlock(block, index)}
            </article>
          ))}
    </div>
  );
}
