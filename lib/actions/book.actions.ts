"use server";
import { connectToDatabase } from "@/database/mongoose";
import { CreateBook, EditBookFormValues, TextSegment } from "@/types";
import { escapeRegex, generateSlug, serializeData } from "../utils";
import Book from "@/database/models/books.model";
import BookSegment from "@/database/models/book-segment.model";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";

export const getBookBySlug = async (bookId: string) => {
  try {
    await connectToDatabase();

    const book = await Book.findOne({ slug: bookId }).lean();

    if (!book) {
      return { success: false, error: "Book not found" };
    }

    return { success: true, data: serializeData(book) };
  } catch (error) {
    console.error("Error fetching book by slug:", error);
    return { success: false, error: error };
  }
};

export const getBookSegments = async (bookId: string) => {
  try {
    await connectToDatabase();

    const segments = await BookSegment.find({ bookId })
      .sort({ segmentIndex: 1 })
      .select("content segmentIndex")
      .lean();

    return { success: true, data: serializeData(segments) };
  } catch (error) {
    console.error("Error fetching book segments:", error);
    return { success: false, error };
  }
};

export const getAllBooks = async () => {
  try {
    await connectToDatabase();

    const books = await Book.find().sort({ createdAt: -1 }).lean();

    return { success: true, books: serializeData(books) };
  } catch (error) {
    console.error("Error fetching all books:", error);
    return { success: false, error: error };
  }
};

export const createBook = async (bookData: CreateBook) => {
  try {
    await connectToDatabase();

    const slug = generateSlug(bookData.title);

    const existingBook = await Book.findOne({ slug }).lean();

    if (existingBook) {
      return {
        success: true,
        data: serializeData(existingBook),
        alreadyExists: true,
      };
    }

    const book = await Book.create({
      ...bookData,
      slug,
      totalSegments: 0,
    });
    revalidatePath("/");
    return { success: true, data: serializeData(book) };
  } catch (error) {
    console.error("Error creating book:", error);
    return { success: false, error: error };
  }
};

export const checkBookExists = async (title: string) => {
  try {
    await connectToDatabase();

    const slug = generateSlug(title);
    const existingBook = await Book.findOne({ slug }).lean();

    if (existingBook) {
      return { exists: true, book: serializeData(existingBook) };
    }
    return { exists: false };
  } catch (error) {
    console.error("Error checking book exists:", error);
    return { exists: false, error: error };
  }
};

export const deleteBook = async (bookId: string) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    const book = await Book.findOne({ _id: bookId, clerkId: userId }).lean();
    if (!book) {
      return { success: false, error: "Book not found" };
    }

    const blobPaths = [book.fileBlobKey, book.coverBlobKey].filter(
      (path): path is string => Boolean(path),
    );
    if (blobPaths.length > 0) {
      await del(blobPaths);
    }

    await BookSegment.deleteMany({ bookId });
    await Book.findByIdAndDelete(bookId);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting book:", error);
    return { success: false, error: error };
  }
};

export const updateBook = async (
  bookId: string,
  bookData: Pick<EditBookFormValues, "title" | "description" | "author" | "voice"> & {
    coverURL?: string;
    coverBlobKey?: string;
  },
) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    const book = await Book.findOne({ _id: bookId, clerkId: userId });
    if (!book) {
      return { success: false, error: "Book not found" };
    }

    const slug = generateSlug(bookData.title);
    const duplicate = await Book.findOne({
      slug,
      _id: { $ne: bookId },
    }).lean();
    if (duplicate) {
      return { success: false, error: "A book with this title already exists." };
    }

    const previousCoverBlobKey = book.coverBlobKey;
    book.title = bookData.title;
    book.description = bookData.description || "";
    book.author = bookData.author;
    book.persona = bookData.voice;
    book.slug = slug;
    if (bookData.coverURL && bookData.coverBlobKey) {
      book.coverURL = bookData.coverURL;
      book.coverBlobKey = bookData.coverBlobKey;
    }
    await book.save();

    if (
      bookData.coverBlobKey &&
      previousCoverBlobKey &&
      previousCoverBlobKey !== bookData.coverBlobKey
    ) {
      await del(previousCoverBlobKey);
    }

    revalidatePath("/");
    revalidatePath(`/books/${slug}`);
    return { success: true, data: serializeData(book) };
  } catch (error) {
    console.error("Error updating book:", error);
    return { success: false, error };
  }
};

export const saveBookSegments = async (
  bookId: string,
  clerkId: string,
  segments: TextSegment[],
) => {
  try {
    await connectToDatabase();

    console.log("Saving book segments for bookId:", bookId);
    const segmentsToInsert = segments.map((segment) => ({
      clerkId,
      bookId,
      content: segment.text,
      segmentIndex: segment.segmentIndex,
      pageNumber: segment.pageNumber,
      wordCount: segment.wordCount,
    }));

    await BookSegment.insertMany(segmentsToInsert);
    await Book.findByIdAndUpdate(bookId, { totalSegments: segments.length });

    console.log("Successfully saved book segments for bookId:", bookId);
    return { success: true, data: { segmentsCreated: segments.length } };
  } catch (error) {
    console.error("Error saving book segments:", error);
    await BookSegment.deleteMany({ bookId });
    await Book.findByIdAndDelete(bookId);
    console.log("Deleted book and segments due to failure to save segments.");
  }
};

export const searchBookSegments = async (
  bookId: string,
  query: string,
  limit: number = 5,
) => {
  try {
    await connectToDatabase();

    console.log(`Searching for: "${query}" in book ${bookId}`);

    const bookObjectId = new mongoose.Types.ObjectId(bookId);

    // Try MongoDB text search first (requires text index)
    let segments: Record<string, unknown>[] = [];
    try {
      segments = await BookSegment.find({
        bookId: bookObjectId,
        $text: { $search: query },
      })
        .select("_id bookId content segmentIndex pageNumber wordCount")
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .lean();
    } catch {
      // Text index may not exist — fall through to regex fallback
      segments = [];
    }

    // Fallback: regex search matching ANY keyword
    if (segments.length === 0) {
      const keywords = query.split(/\s+/).filter((k) => k.length > 2);
      const pattern = keywords.map(escapeRegex).join("|");

      segments = await BookSegment.find({
        bookId: bookObjectId,
        content: { $regex: pattern, $options: "i" },
      })
        .select("_id bookId content segmentIndex pageNumber wordCount")
        .sort({ segmentIndex: 1 })
        .limit(limit)
        .lean();
    }

    console.log(`Search complete. Found ${segments.length} results`);

    return {
      success: true,
      data: serializeData(segments),
    };
  } catch (error) {
    console.error("Error searching segments:", error);
    return {
      success: false,
      error: (error as Error).message,
      data: [],
    };
  }
};
