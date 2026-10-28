"use client";

// Create hooks/useVapi.ts: the core hook. Initializes Vapi SDK, manages call lifecycle (idle, connecting, starting, listening, thinking, speaking), tracks messages array + currentMessage streaming, handles duration timer with maxDuration enforcement, session tracking via server actions

import { useState, useEffect, useRef, useCallback } from "react";
import Vapi from "@vapi-ai/web";
import { useAuth } from "@clerk/nextjs";

import { ASSISTANT_ID, DEFAULT_VOICE, VOICE_SETTINGS } from "@/lib/constants";
import { getVoice } from "@/lib/utils";
import { IBook, Messages } from "@/types";
import {
  startVoiceSession,
  endVoiceSession,
} from "@/lib/actions/session.actions";

export function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const TIMER_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const TIME_WARNING_THRESHOLD = 60; // Show warning when this many seconds remain
const VAPI_SILENCE_TIMEOUT_SECONDS = 3600;

let vapi: InstanceType<typeof Vapi>;
function getVapi() {
  if (!vapi) {
    if (!VAPI_API_KEY) {
      throw new Error(
        "NEXT_PUBLIC_VAPI_API_KEY environment variable is not set",
      );
    }
    vapi = new Vapi(VAPI_API_KEY);
  }
  return vapi;
}

const getFirstMessage = (title: string) =>
  `Hey, good to meet you. Quick question before we dive in - have you actually read ${title} yet, or are we starting fresh?`;

export type CallStatus =
  | "idle"
  | "connecting"
  | "starting"
  | "listening"
  | "thinking"
  | "speaking";

export function useVapi(book: IBook) {
  const { userId } = useAuth();
  // const { limits } = useSubscription();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [messages, setMessages] = useState<Messages[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [currentUserMessage, setCurrentUserMessage] = useState("");
  const [duration, setDuration] = useState(0);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  const pendingMessageRef = useRef<string | null>(null);

  // Keep refs in sync with latest values for use in callbacks
  // const maxDurationRef = useLatestRef(limits.maxSessionMinutes * 60);
  const durationRef = useLatestRef(duration);
  const currentMessageRef = useLatestRef(currentMessage);
  const voice = book.persona || DEFAULT_VOICE;

  // Set up Vapi event listeners
  useEffect(() => {
    const handlers = {
      "call-start": () => {
        isStoppingRef.current = false;
        getVapi().setMuted(true);
        setIsMuted(true);
        setStatus("starting"); // AI speaks first, wait for it
        setCurrentMessage("");
        setCurrentUserMessage("");

        const pendingMessage = pendingMessageRef.current;
        pendingMessageRef.current = null;
        if (pendingMessage) {
          setMessages((previousMessages) => [
            ...previousMessages,
            { role: "user", content: pendingMessage },
          ]);
          setStatus("thinking");
          getVapi().send({
            type: "add-message",
            message: { role: "user", content: pendingMessage },
            triggerResponseEnabled: true,
          });
        }

        // Start duration timer
        startTimeRef.current = Date.now();
        setDuration(0);
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            const newDuration = Math.floor(
              (Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS,
            );
            setDuration(newDuration);

            // Check duration limit
            // if (newDuration >= maxDurationRef.current) {
            //     getVapi().stop();
            //     setLimitError(
            //         `Session time limit (${Math.floor(
            //             maxDurationRef.current / SECONDS_PER_MINUTE,
            //         )} minutes) reached. Upgrade your plan for longer sessions.`,
            //     );
            // }
          }
        }, TIMER_INTERVAL_MS);
      },

      "call-end": () => {
        // Don't reset isStoppingRef here - delayed events may still fire
        setStatus("idle");
        setCurrentMessage("");
        setCurrentUserMessage("");
        setIsMuted(false);
        pendingMessageRef.current = null;

        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // End session tracking
        if (sessionIdRef.current) {
          endVoiceSession(sessionIdRef.current, durationRef.current).catch(
            (err) => console.error("Failed to end voice session:", err),
          );
          sessionIdRef.current = null;
        }

        startTimeRef.current = null;
      },

      "speech-start": () => {
        if (!isStoppingRef.current) {
          setStatus("speaking");
        }
      },
      "speech-end": () => {
        if (!isStoppingRef.current) {
          // After AI finishes speaking, user can talk
          setStatus("listening");
        }

        const completedMessage = currentMessageRef.current.trim();
        if (completedMessage) {
          setMessages((previousMessages) => {
            const lastMessage = previousMessages.at(-1);
            if (
              lastMessage?.role === "assistant" &&
              lastMessage.content === completedMessage
            ) {
              return previousMessages;
            }
            return [
              ...previousMessages,
              { role: "assistant", content: completedMessage },
            ];
          });
          setCurrentMessage("");
        }
      },

      message: (message: {
        type?: string;
        role?: string;
        transcriptType?: string;
        transcript?: string;
        output?: string;
        conversation?: Array<{
          role?: string;
          content?: string;
        }>;
      }) => {
        const addFinalMessage = (
          role: "user" | "assistant",
          content: string,
        ) => {
          const trimmedContent = content.trim();
          if (!trimmedContent) return;

          setMessages((previousMessages) => {
            const isDupe = previousMessages.some(
              (previousMessage) =>
                previousMessage.role === role &&
                previousMessage.content === trimmedContent,
            );
            if (isDupe) return previousMessages;

            return [...previousMessages, { role, content: trimmedContent }];
          });
        };

        if (message.type === "conversation-update") {
          return;
        }

        if (
          message.type === "model-output" &&
          typeof message.output === "string"
        ) {
          setCurrentMessage(message.output.trim());
          return;
        }

        if (
          (message.role !== "user" && message.role !== "assistant") ||
          typeof message.transcript !== "string" ||
          !message.transcript.trim() ||
          (message.transcriptType !== "partial" &&
            message.transcriptType !== "final")
        ) {
          return;
        }

        const role = message.role as "user" | "assistant";
        const transcript = message.transcript.trim();

        // User finished speaking → AI is thinking
        if (role === "user" && message.transcriptType === "final") {
          if (!isStoppingRef.current) {
            setStatus("thinking");
          }
          setCurrentUserMessage("");
        }

        // Partial user transcript → show real-time typing
        if (role === "user" && message.transcriptType === "partial") {
          setCurrentUserMessage(transcript);
          return;
        }

        // Partial AI transcript → show word-by-word
        if (role === "assistant" && message.transcriptType === "partial") {
          setCurrentMessage(transcript);
          return;
        }

        // Final transcript → add to messages
        if (message.transcriptType === "final") {
          if (role === "assistant") {
            const completedMessage = currentMessageRef.current || transcript;
            setCurrentMessage("");
            addFinalMessage(role, completedMessage);
            return;
          }
          if (role === "user") setCurrentUserMessage("");

          addFinalMessage(role, transcript);
        }
      },

      error: (error: Error) => {
        console.error("Vapi error:", error);
        // Don't reset isStoppingRef here - delayed events may still fire
        setStatus("idle");
        setCurrentMessage("");
        setCurrentUserMessage("");
        pendingMessageRef.current = null;

        // Stop timer on error
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // End session tracking on error
        if (sessionIdRef.current) {
          endVoiceSession(sessionIdRef.current, durationRef.current).catch(
            (err) =>
              console.error("Failed to end voice session on error:", err),
          );
          sessionIdRef.current = null;
        }

        // Show user-friendly error message
        const errorMessage = error.message?.toLowerCase() || "";
        if (
          errorMessage.includes("timeout") ||
          errorMessage.includes("silence")
        ) {
          setLimitError(
            "Session ended due to inactivity. Click the mic to start again.",
          );
        } else if (
          errorMessage.includes("network") ||
          errorMessage.includes("connection")
        ) {
          setLimitError(
            "Connection lost. Please check your internet and try again.",
          );
        } else {
          setLimitError(
            "Vapi AI assistant is currently unavailable. Please try again later.",
          );
        }

        startTimeRef.current = null;
      },
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      getVapi().on(event as keyof typeof handlers, handler as () => void);
    });

    return () => {
      // End active session on unmount
      if (sessionIdRef.current) {
        getVapi().stop();
        endVoiceSession(sessionIdRef.current, durationRef.current).catch(
          (err) =>
            console.error("Failed to end voice session on unmount:", err),
        );
        sessionIdRef.current = null;
      }
      // Cleanup handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        getVapi().off(event as keyof typeof handlers, handler as () => void);
      });
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = useCallback(
    async (options?: { speakFirst?: boolean }): Promise<boolean> => {
      const speakFirst = options?.speakFirst ?? true;
      if (!userId) {
        setLimitError("Please sign in to start a voice session.");
        return false;
      }

      setLimitError(null);
      setStatus("connecting");

      try {
        // Check session limits and create session record in DB
        const result = await startVoiceSession(userId, book._id);

        if (!result.success) {
          setLimitError(
            result.error || "Session limit reached. Please upgrade your plan.",
          );
          setStatus("idle");
          return false;
        }

        sessionIdRef.current = result.sessionId || null;
        // Note: Server-returned maxDurationMinutes is informational only
        // The actual limit is enforced by useLatestRef(limits.maxSessionMinutes * 60)

        type AssistantOverridesWithSilence = Parameters<
          InstanceType<typeof Vapi>["start"]
        >[1] & {
          silenceTimeoutSeconds?: number;
        };

        const assistantOverrides: AssistantOverridesWithSilence = {
          ...(speakFirst
            ? {
                firstMessage: getFirstMessage(book.title),
                firstMessageMode: "assistant-speaks-first" as const,
              }
            : {
                firstMessageMode: "assistant-waits-for-user" as const,
              }),
          silenceTimeoutSeconds: VAPI_SILENCE_TIMEOUT_SECONDS,
          variableValues: {
            title: book.title,
            author: book.author,
            bookId: book._id,
          },
          voice: {
            provider: "11labs" as const,
            voiceId: getVoice(voice).id,
            model: "eleven_turbo_v2_5" as const,
            stability: VOICE_SETTINGS.stability,
            similarityBoost: VOICE_SETTINGS.similarityBoost,
            style: VOICE_SETTINGS.style,
            useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
          },
        };

        await getVapi().start(ASSISTANT_ID, assistantOverrides);
        return true;
      } catch (err) {
        console.error("Failed to start call:", err);
        setStatus("idle");
        setLimitError("Failed to start voice session. Please try again.");
        return false;
      }
    },
    [book._id, book.title, book.author, voice, userId],
  );

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    getVapi().stop();
  }, []);

  const isActive =
    status === "starting" ||
    status === "listening" ||
    status === "thinking" ||
    status === "speaking";

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return false;
      }

      if (!isActive) {
        pendingMessageRef.current = trimmedContent;
        const started = await start({ speakFirst: false });
        if (!started) {
          pendingMessageRef.current = null;
          return false;
        }
        return true;
      }

      setMessages((previousMessages) => {
        const alreadyAdded = previousMessages.some(
          (message) =>
            message.role === "user" && message.content === trimmedContent,
        );
        return alreadyAdded
          ? previousMessages
          : [...previousMessages, { role: "user", content: trimmedContent }];
      });
      setStatus("thinking");
      getVapi().send({
        type: "add-message",
        message: {
          role: "user",
          content: trimmedContent,
        },
        triggerResponseEnabled: true,
      });
      return true;
    },
    [isActive, start],
  );

  const toggleMute = useCallback(() => {
    if (!isActive) {
      return false;
    }

    const nextMutedState = !getVapi().isMuted();
    getVapi().setMuted(nextMutedState);
    setIsMuted(nextMutedState);
    return true;
  }, [isActive]);

  const clearError = useCallback(() => {
    setLimitError(null);
  }, []);

  // Calculate remaining time
  // const maxDurationSeconds = limits.maxSessionMinutes * SECONDS_PER_MINUTE;
  // const remainingSeconds = Math.max(0, maxDurationSeconds - duration);
  // const showTimeWarning =
  //     isActive && remainingSeconds <= TIME_WARNING_THRESHOLD && remainingSeconds > 0;

  return {
    status,
    isActive,
    messages,
    currentMessage,
    currentUserMessage,
    duration,
    start,
    stop,
    sendMessage,
    isMuted,
    toggleMute,
    limitError,
    clearError,
    // maxDurationSeconds,
    // remainingSeconds,
    // showTimeWarning,
  };
}

export default useVapi;
