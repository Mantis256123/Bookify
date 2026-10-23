"use client";

import { FormEvent, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import useVapi from "@/app/hooks/useVapi";
import { IBook } from "@/types";
import Transcript from "./Transcript";

type VapiControlsProps = {
  book: IBook;
};

export default function VapiControls({ book }: VapiControlsProps) {
  const {
    status,
    messages: vapiMessages,
    currentMessage,
    currentUserMessage,
    isActive,
    start,
    stop,
    sendMessage,
  } = useVapi(book);
  const [question, setQuestion] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return;
    }

    if (sendMessage(trimmedQuestion)) {
      setQuestion("");
    }
  };

  const messages = vapiMessages.filter(
    (message): message is typeof message & {
      role: "user" | "assistant";
    } => message.role === "user" || message.role === "assistant",
  );
  const isAiResponding = status === "thinking" || status === "speaking";

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[#eadfce] bg-white shadow-[0_8px_30px_rgba(61,48,34,0.06)] lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:max-h-[calc(100vh-6rem)] lg:self-start lg:w-[360px]">
      <div className="border-b border-[#eee4d6] px-5 py-4">
        <h2 className="font-bold text-[#212a3b]">Chat with {book.title}</h2>
        <p className="text-xs text-[#777]">
          Ask a question about the uploaded book.
        </p>
      </div>
      <div className="vapi-transcript-wrapper flex-1">
        <Transcript
          messages={messages}
          currentMessage={currentMessage}
          currentUserMessage={currentUserMessage}
        />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-[#eee4d6] p-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#d8cdbd] bg-[#faf7f1] p-2 focus-within:border-[#8b5e34]">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about this book..."
            aria-label="Ask about this book"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-[#212a3b] outline-none placeholder:text-[#999]"
          />
          <button
            type="button"
            onClick={() => void (isActive ? stop() : start())}
            disabled={status === "connecting"}
            aria-label={isActive ? "Stop talking to the book" : "Talk to the book"}
            className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f3e4c7] text-[#663820] transition-colors hover:bg-[#ead7b4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAiResponding && (
              <span
                className="absolute inset-0 animate-ping rounded-lg bg-white"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10">
              {isActive ? (
                <Mic className="size-4" aria-hidden="true" />
              ) : (
                <MicOff className="size-4" aria-hidden="true" />
              )}
            </span>
          </button>
          <button
            type="submit"
            aria-label="Send question"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#663820] text-white transition-colors hover:bg-[#8b5e34]"
          >
            <Send className="size-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </aside>
  );
}
