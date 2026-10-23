import BookCard from "@/components/BookCard";
import HeroSection from "@/components/HeroSection";
import { getAllBooks } from "@/lib/actions/book.actions";
import { connection } from "next/server";

export const instant = false;
export const dynamic = "force-dynamic";

export default async function Page() {
  await connection();

  const bookResults = await getAllBooks();
  const books = bookResults.success ? (bookResults.books ?? []) : [];

  return (
    <main className="container wrapper">
      <HeroSection />

      <div className="library-books-grid">
        {books.length > 0 ? (
          books.map((book) => (
            <BookCard
              key={book._id}
              title={book.title}
              author={book.author}
              coverURL={book.coverURL}
              slug={book.slug}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-lg md:text-xl text-[#3d485e] leading-7 md:leading-8">
            No books have been uploaded yet.
          </p>
        )}
      </div>
    </main>
  );
}
