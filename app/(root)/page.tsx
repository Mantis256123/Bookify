import HeroSection from "@/components/HeroSection";
import { getAllBooks } from "@/lib/actions/book.actions";
import { connection } from "next/server";
import BookLibrary from "@/components/BookLibrary";

export const instant = false;

export default async function Page() {
  await connection();

  const bookResults = await getAllBooks();
  const books = bookResults.success ? (bookResults.books ?? []) : [];

  return (
    <main className="container wrapper">
      <HeroSection />

      <BookLibrary books={books} />
    </main>
  );
}
