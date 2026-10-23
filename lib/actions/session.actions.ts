"use server";

import VoiceSession from "@/database/models/voice-session.model";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@clerk/nextjs/server";
import { getCurrentBillingPeriodStart } from "../subscription-constants";

type SessionActionResult =
  | { success: true; sessionId: string }
  | { success: false; error: string };

export const startVoiceSession = async (
  userId: string,
  bookId: string,
): Promise<SessionActionResult> => {
  try {
    await connectToDatabase();

    const session = await VoiceSession.create({
      clerkId: userId,
      bookId,
      startedAt: new Date(),
      billingPeriodStart: getCurrentBillingPeriodStart(),
      durationSeconds: 0,
    });

    return {
      success: true,
      sessionId: session._id.toString(),
    };
  } catch (error) {
    console.error("Error starting voice session:", error);
    return { success: false, error: "Failed to start voice session." };
  }
};

export const endVoiceSession = async (
  sessionId: string,
  durationSeconds: number,
): Promise<{ success: true } | { success: false; error: string }> => {
  if (!sessionId.trim()) {
    return { success: false, error: "A session ID is required." };
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return {
      success: false,
      error: "Duration must be a non-negative number.",
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "You must be signed in to end a session." };
  }

  try {
    await connectToDatabase();

    const session = await VoiceSession.findOneAndUpdate(
      { _id: sessionId, clerkId: userId },
      {
        endedAt: new Date(),
        durationSeconds,
      },
      { new: true },
    ).select("_id");

    if (!session) {
      return { success: false, error: "Voice session not found." };
    }

    return { success: true };
  } catch (error) {
    console.error("Error ending voice session:", error);
    return { success: false, error: "Failed to end voice session." };
  }
};
