"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { MAX_FILE_SIZE, MAX_IMAGE_SIZE, voiceOptions } from "@/lib/constants";
import { UploadSchema } from "@/lib/zod";
import type { BookUploadFormValues } from "@/types";
import LoadingOverlay from "@/components/LoadingOverlay";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn, parseBookFile } from "@/lib/utils";
import {
  checkBookExists,
  createBook,
  saveBookSegments,
} from "@/lib/actions/book.actions";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

const voices = [
  { group: "Male Voices", items: ["dave", "daniel", "chris"] },
  { group: "Female Voices", items: ["rachel", "sarah"] },
] as const;

const BOOK_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const BOOK_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const COVER_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

const UploadForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragging, setDragging] = useState<"book" | "cover" | null>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<BookUploadFormValues>({
    resolver: zodResolver(UploadSchema),
    defaultValues: {
      coverFile: undefined,
      title: "",
      author: "",
      voice: "rachel",
    },
  });
  const bookFile = useWatch({ control: form.control, name: "bookFile" });
  const coverFile = useWatch({ control: form.control, name: "coverFile" });

  const { userId } = useAuth();
  const router = useRouter();

  const onSubmit = async (values: BookUploadFormValues) => {
    if (!userId) {
      toast.error("Please login to upload a book.");
      return;
    }

    setIsSubmitting(true);
    try {
      const existsCheck = await checkBookExists(values.title);
      if (existsCheck.exists && existsCheck.book) {
        toast.info("Book with the same title already exists.");
        form.reset();
        router.push(`/books/${existsCheck.book.slug}`);
        return;
      }

      const fileTitle = values.title.replace(/\s+/g, "_").toLowerCase();
      const bookFile = values.bookFile;

      const parsedBook = await parseBookFile(bookFile);
      if (parsedBook.content.length === 0) {
        toast.error("The selected file does not contain readable text.");
        return;
      }

      const contentType = bookFile.type || "application/octet-stream";
      const uploadedBookBlob = await upload(fileTitle, bookFile, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType,
      });

      let coverUrl = "/assets/book-cover.svg";
      let coverBlobKey: string | undefined;

      if (values.coverFile) {
        const coverFile = values.coverFile;
        const uploadedCoverBlob = await upload(
          `${fileTitle}_cover.png`,
          coverFile,
          {
            access: "public",
            handleUploadUrl: "/api/upload",
            contentType: coverFile.type,
          },
        );
        coverUrl = uploadedCoverBlob.url;
        coverBlobKey = uploadedCoverBlob.pathname;
      } else if (parsedBook.cover) {
        const response = await fetch(parsedBook.cover);
        if (!response.ok) {
          throw new Error("Could not prepare the generated book cover.");
        }
        const blob = await response.blob();
        const uploadedCoverBlob = await upload(`${fileTitle}_cover.png`, blob, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: "image/png",
        });
        coverUrl = uploadedCoverBlob.url;
        coverBlobKey = uploadedCoverBlob.pathname;
      }

      const book = await createBook({
        clerkId: userId,
        title: values.title,
        author: values.author,
        persona: values.voice,
        fileURL: uploadedBookBlob.url,
        fileBlobKey: uploadedBookBlob.pathname,
        coverURL: coverUrl,
        coverBlobKey,
        fileSize: bookFile.size,
      });

      if (!book.success || !book.data) {
        throw new Error("Could not create the book.");
      }
      if (book.alreadyExists) {
        toast.info("Book with the same title already exists.");
        form.reset();
        router.push(`/books/${book.data.slug}`);
        return;
      }

      const segmentsResult = await saveBookSegments(
        book.data._id.toString(),
        userId,
        parsedBook.content,
      );
      if (!segmentsResult?.success) {
        toast.error("Failed to save book segments. Please try again.");
        throw new Error("Could not save the book content.");
      }

      form.reset();
      router.push(`/`);
    } catch (error) {
      console.error("Error uploading book:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not upload the book. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFileError = (file: File, type: "book" | "cover") => {
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const maxSize = type === "book" ? MAX_FILE_SIZE : MAX_IMAGE_SIZE;
    const maxSizeLabel = type === "book" ? "50MB" : "10MB";

    if (file.size > maxSize) {
      return `File must be smaller than ${maxSizeLabel}.`;
    }

    const validType =
      type === "book"
        ? BOOK_TYPES.includes(file.type) || BOOK_EXTENSIONS.includes(extension)
        : file.type.startsWith("image/") ||
          COVER_EXTENSIONS.includes(extension);

    return validType
      ? null
      : type === "book"
        ? "Only PDF, Word, and TXT files are supported."
        : "Only PNG, JPG, JPEG, GIF, WEBP, and SVG images are supported.";
  };

  const selectFile = (
    file: File | undefined,
    type: "book" | "cover",
    onChange: (value: File | undefined) => void,
    setError: (error: { type: string; message: string }) => void,
  ) => {
    if (!file) return;

    const fileError = getFileError(file, type);
    if (fileError) {
      onChange(undefined);
      setError({
        type: "validate",
        message: fileError,
      });
      return;
    }

    form.clearErrors(type === "book" ? "bookFile" : "coverFile");
    onChange(file);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    type: "book" | "cover",
    onChange: (value: File | undefined) => void,
    setError: (error: { type: string; message: string }) => void,
  ) => {
    event.preventDefault();
    setDragging(null);
    selectFile(event.dataTransfer.files[0], type, onChange, setError);
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="new-book-wrapper !mt-0 !mb-0 space-y-8"
        >
          <FormField
            control={form.control}
            name="bookFile"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Book File</FormLabel>
                <FormControl>
                  <div
                    className={cn(
                      "upload-dropzone border-2 border-dashed border-[#d8cdbd] bg-white",
                      fieldState.error && "border-red-300",
                      dragging === "book" && "border-[#663820] bg-[#fff6e5]",
                    )}
                    onClick={() => bookInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        bookInputRef.current?.click();
                      }
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragging("book");
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragging(null);
                    }}
                    onDrop={(event) =>
                      handleDrop(event, "book", field.onChange, (error) =>
                        form.setError("bookFile", error),
                      )
                    }
                    role="button"
                    tabIndex={0}
                  >
                    <input
                      ref={bookInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      className="hidden"
                      onChange={(event) =>
                        selectFile(
                          event.target.files?.[0],
                          "book",
                          field.onChange,
                          (error) => form.setError("bookFile", error),
                        )
                      }
                    />
                    {bookFile ? (
                      <div className="flex items-center gap-3 text-[#663820]">
                        <Upload className="upload-dropzone-icon mb-0" />
                        <span className="max-w-[200px] truncate font-medium">
                          {bookFile.name}
                        </span>
                        <span className="font-medium">
                          {(bookFile.size / 1024 / 1024).toFixed(2) + " MB"}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove book file"
                          className="upload-dropzone-remove"
                          onClick={(event) => {
                            event.stopPropagation();
                            field.onChange(undefined);
                            if (bookInputRef.current) {
                              bookInputRef.current.value = "";
                            }
                          }}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="upload-dropzone-icon" />
                        <span className="upload-dropzone-text">
                          Click to upload a book file
                        </span>
                        <span className="upload-dropzone-hint">
                          PDF, Word, or TXT file (max 50MB)
                        </span>
                      </>
                    )}
                  </div>
                </FormControl>
                <FormMessage name="bookFile" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="coverFile"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Cover Image (Optional)</FormLabel>
                <FormControl>
                  <div
                    className={cn(
                      "upload-dropzone border-2 border-dashed border-[#d8cdbd] bg-white",
                      fieldState.error && "border-red-300",
                      dragging === "cover" && "border-[#663820] bg-[#fff6e5]",
                    )}
                    onClick={() => coverInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        coverInputRef.current?.click();
                      }
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragging("cover");
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragging(null);
                    }}
                    onDrop={(event) =>
                      handleDrop(event, "cover", field.onChange, (error) =>
                        form.setError("coverFile", error),
                      )
                    }
                    role="button"
                    tabIndex={0}
                  >
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.gif,.webp,.svg,image/*"
                      className="hidden"
                      onChange={(event) =>
                        selectFile(
                          event.target.files?.[0],
                          "cover",
                          field.onChange,
                          (error) => form.setError("coverFile", error),
                        )
                      }
                    />
                    {coverFile ? (
                      <div className="flex items-center gap-3 text-[#663820]">
                        <ImageIcon className="upload-dropzone-icon mb-0" />
                        <span className="max-w-[240px] truncate font-medium">
                          {coverFile.name}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove cover image"
                          className="upload-dropzone-remove"
                          onClick={(event) => {
                            event.stopPropagation();
                            field.onChange(undefined);
                            if (coverInputRef.current) {
                              coverInputRef.current.value = "";
                            }
                          }}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="upload-dropzone-icon" />
                        <span className="upload-dropzone-text">
                          Click to upload cover image
                        </span>
                        <span className="upload-dropzone-hint">
                          Leave empty to use a default cover
                        </span>
                      </>
                    )}
                  </div>
                </FormControl>
                <FormMessage name="coverFile" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <input
                    {...field}
                    className="form-input"
                    placeholder="ex: Rich Dad Poor Dad"
                  />
                </FormControl>
                <FormMessage name="title" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="author"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Author Name</FormLabel>
                <FormControl>
                  <input
                    {...field}
                    className="form-input"
                    placeholder="ex: Robert Kiyosaki"
                  />
                </FormControl>
                <FormMessage name="author" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="voice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Choose Assistant Voice</FormLabel>
                <FormControl>
                  <div className="space-y-5">
                    {voices.map((voiceGroup) => (
                      <fieldset key={voiceGroup.group}>
                        <legend className="mb-2 text-sm text-[var(--text-secondary)]">
                          {voiceGroup.group}
                        </legend>
                        <div className="voice-selector-options flex-wrap">
                          {voiceGroup.items.map((voiceId) => {
                            const voice = voiceOptions[voiceId];
                            const selected = field.value === voiceId;
                            return (
                              <label
                                key={voiceId}
                                className={cn(
                                  "voice-selector-option min-w-[150px] cursor-pointer",
                                  selected && "voice-selector-option-selected",
                                )}
                              >
                                <input
                                  type="radio"
                                  name={field.name}
                                  value={voiceId}
                                  checked={selected}
                                  onChange={() => field.onChange(voiceId)}
                                  className="accent-[#663820]"
                                />
                                <span className="text-left">
                                  <span className="block font-semibold text-[var(--text-primary)]">
                                    {voice.name}
                                  </span>
                                  <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                                    {voice.description}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </FormControl>
                <FormMessage name="voice" />
              </FormItem>
            )}
          />

          <button type="submit" className="form-btn" disabled={isSubmitting}>
            Begin Synthesis
          </button>
        </form>
      </Form>
      {isSubmitting && <LoadingOverlay />}
    </>
  );
};

export default UploadForm;
