"use client";

import { Mic } from "lucide-react";
import { useEffect, useRef } from "react";

export type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

type TranscriptProps = {
  messages: TranscriptMessage[];
  currentMessage?: string;
  currentUserMessage?: string;
};

export default function Transcript({
  messages,
  currentMessage = "",
  currentUserMessage = "",
}: TranscriptProps) {
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        96;
      if (!isNearBottom) {
        return;
      }
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, currentMessage, currentUserMessage]);

  const hasConversation =
    messages.length > 0 || currentMessage.length > 0 || currentUserMessage.length > 0;

  return (
    <div className="transcript-container">
      {!hasConversation ? (
        <div className="transcript-empty">
          <Mic className="mb-3 size-9 text-[#8b5e34]" aria-hidden="true" />
          <p className="transcript-empty-text">No conversation yet</p>
          <p className="transcript-empty-hint">
            Ask a question or tap the microphone to start talking.
          </p>
        </div>
      ) : (
        <div ref={messagesRef} className="transcript-messages">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`transcript-message ${
                message.role === "user"
                  ? "transcript-message-user"
                  : "transcript-message-assistant"
              }`}
            >
              <p
                className={`transcript-bubble ${
                  message.role === "user"
                    ? "transcript-bubble-user"
                    : "transcript-bubble-assistant"
                }`}
              >
                {message.content}
              </p>
            </div>
          ))}
          {currentUserMessage && (
            <div className="transcript-message transcript-message-user">
              <p className="transcript-bubble transcript-bubble-user">
                {currentUserMessage}
                <span className="transcript-cursor bg-white" aria-hidden="true" />
              </p>
            </div>
          )}
          {currentMessage && (
            <div className="transcript-message transcript-message-assistant">
              <p className="transcript-bubble transcript-bubble-assistant">
                {currentMessage}
                <span className="transcript-cursor" aria-hidden="true" />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
