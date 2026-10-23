import { auth } from "@clerk/nextjs/server";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import BookReader from "@/components/BookReader";
import BookFileStats from "@/components/BookFileStats";
import { getBookBySlug, getBookSegments } from "@/lib/actions/book.actions";
import Image from "next/image";
import { ArrowDown } from "lucide-react";

export const instant = false;

export default async function BookDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();

  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { slug } = await params;
  const result = await getBookBySlug(slug);

  if (!result.success || !result.data) {
    redirect("/");
  }

  const book = result.data;
  const segmentsResult = await getBookSegments(book._id.toString());

  return (
    <div className="book-page-container">
      <Link href="/" className="back-btn-floating">
        <span aria-hidden="true">←</span>
        <span className="sr-only">Back to library</span>
      </Link>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="vapi-header-card">
          <div className="vapi-cover-wrapper flex flex-col items-center gap-4">
            <Image
              src={book.coverURL || "/assets/book-cover.svg"}
              alt={book.title}
              width={140}
              height={200}
              className="vapi-cover-image !h-auto !w-[120px]"
              priority
            />
            <Link
              href="#book-reader"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#663820] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#7a4528] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#663820]"
            >
              <span>Read now</span>
              <ArrowDown className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-4 self-start">
            <div>
              <h1 className="font-serif text-3xl font-bold text-[#212a3b]">
                {book.title}
              </h1>
              <p className="mt-2 text-lg text-[#3d485e]">by {book.author}</p>
            </div>
            <BookFileStats fileURL={book.fileURL} />
          </div>
        </div>
      </div>
      <div id="book-reader" className="scroll-mt-20">
        <BookReader
          title={book.title}
          author={book.author}
          fileURL={book.fileURL}
          segments={segmentsResult.success ? (segmentsResult.data ?? []) : []}
          book={book}
        />
      </div>
    </div>
  );
}
