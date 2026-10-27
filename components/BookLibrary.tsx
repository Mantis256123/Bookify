"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import BookCard from "@/components/BookCard";

type Book = {
  _id: string;
  title: string;
  author: string;
  coverURL: string;
  slug: string;
};

type BookLibraryProps = {
  books: Book[];
};

const BookLibrary = ({ books }: BookLibraryProps) => {
  const [searchText, setSearchText] = useState("");

  const filteredBooks = books.filter((book) => {
    const query = searchText.trim().toLowerCase();

    return (
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query)
    );
  });

  return (
    <section>
      {/* Search */}
      <div className="mx-auto flex w-full max-w-sm items-center justify-between rounded-full border-2 border-[#d1d5dba2] bg-white px-4 py-3 sm:max-w-md sm:px-5 md:max-w-lg">
        <input
          type="text"
          placeholder="Search books by title or author"
          className="flex-1 bg-transparent text-lg text-[#3d485e] outline-none placeholder:text-[#3d485e]"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <SearchIcon className="h-6 w-6 shrink-0 text-[#3d485e] cursor-pointer" />
      </div>

      {/* Book list */}
      <div className="library-books-grid pt-8">
        {filteredBooks.length > 0 ? (
          filteredBooks.map((book) => (
            <BookCard
              key={book._id}
              title={book.title}
              author={book.author}
              coverURL={book.coverURL}
              slug={book.slug}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-lg leading-7 text-[#3d485e] md:text-xl md:leading-8">
            {searchText.trim()
              ? "No books match your search."
              : "No books have been uploaded yet."}
          </p>
        )}
      </div>
    </section>
  );
};

export default BookLibrary;
