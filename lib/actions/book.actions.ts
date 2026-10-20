"use server";
import { connectToDatabase } from "@/database/mongoose";
import { CreateBook, TextSegment } from "@/types";
import { generateSlug, serializeData } from "../utils";
import Book from "@/database/models/books.model";
import BookSegment from "@/database/models/book-segment.model";

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
