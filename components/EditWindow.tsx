"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { updateBook } from "@/lib/actions/book.actions";
import { voiceOptions } from "@/lib/constants";
import { EditBookSchema } from "@/lib/zod";
import type { EditBookFormValues } from "@/types";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type EditWindowProps = {
  bookId: string;
  initialValues: {
    title: string;
    description?: string;
    author: string;
    voice?: string;
    coverURL?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const voices = [
  { group: "Male Voices", items: ["dave", "daniel", "chris"] },
  { group: "Female Voices", items: ["rachel", "sarah"] },
] as const;

const EditWindow = ({
  bookId,
  initialValues,
  open,
  onOpenChange,
}: EditWindowProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverPreview, setCoverPreview] = useState(initialValues.coverURL);
  const router = useRouter();
  const form = useForm<EditBookFormValues>({
    resolver: zodResolver(EditBookSchema),
    defaultValues: {
      title: initialValues.title,
      description: initialValues.description || "",
      author: initialValues.author,
      voice: initialValues.voice || "rachel",
      coverFile: undefined,
    },
  });

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = async (values: EditBookFormValues) => {
    setIsSubmitting(true);
    try {
      let coverURL: string | undefined;
      let coverBlobKey: string | undefined;
      if (values.coverFile) {
        const uploadedCover = await upload(
          `${values.title.replace(/\s+/g, "_").toLowerCase()}_cover`,
          values.coverFile,
          {
            access: "public",
            handleUploadUrl: "/api/uploads",
            contentType: values.coverFile.type,
          },
        );
        coverURL = uploadedCover.url;
        coverBlobKey = uploadedCover.pathname;
      }

      const result = await updateBook(bookId, {
        title: values.title,
        description: values.description,
        author: values.author,
        voice: values.voice,
        coverURL,
        coverBlobKey,
      });
      if (!result.success) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Could not update this book.",
        );
        return;
      }

      toast.success("Book updated.");
      onOpenChange(false);
      router.push(`/books/${result.data.slug}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update this book.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#212a3b]/60 px-4 py-10 sm:py-14"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onOpenChange(false);
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-book-title"
        className="flex max-h-[calc(100vh-5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#d8cbb9] bg-[#fffdf9] shadow-[0_18px_60px_rgba(61,48,34,0.3)] sm:max-h-[calc(100vh-7rem)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d8cbb9] bg-[#f8f4e9] px-5 py-5 sm:px-7">
          <div>
            <h2
              id="edit-book-title"
              className="font-serif text-2xl font-bold text-[#212a3b] sm:text-3xl"
            >
              Edit book
            </h2>
            <p className="mt-2 text-sm text-[#3d485e]">
              Update the book details. The uploaded book file will stay
              unchanged.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close edit window"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="cursor-pointer rounded-full p-2 text-[#3d485e] hover:bg-[#e8d8ba] hover:text-[#212a3b] disabled:opacity-40"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="min-h-0 overflow-y-auto space-y-5 bg-[#f8f4e9] px-5 py-5 sm:px-7"
          >
            <FormField
              control={form.control}
              name="coverFile"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Cover Image</FormLabel>
                  <FormControl>
                    <label className="upload-dropzone h-[125px] border-2 border-dashed border-[#d8c2a2] bg-white">
                      {coverPreview ? (
                        <img
                          src={coverPreview}
                          alt=""
                          className="size-12 rounded object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-6" aria-hidden="true" />
                      )}
                      <span className="upload-dropzone-text text-base">
                        {value?.name || "Click to choose a new cover image"}
                      </span>
                      <span className="upload-dropzone-hint">
                        Leave empty to keep the current cover
                      </span>
                      <input
                        {...field}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          onChange(file);
                          if (file) setCoverPreview(URL.createObjectURL(file));
                        }}
                      />
                    </label>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      className="form-input min-h-24 resize-y"
                      placeholder="ex: A book about financial independence"
                    />
                  </FormControl>
                  <FormMessage name="description" />
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
                    <div className="space-y-4">
                      {voices.map((group) => (
                        <fieldset key={group.group}>
                          <legend className="mb-2 text-sm text-[#3d485e]">
                            {group.group}
                          </legend>
                          <div className="voice-selector-options flex-wrap">
                            {group.items.map((voiceId) => {
                              const voice = voiceOptions[voiceId];
                              return (
                                <label
                                  key={voiceId}
                                  className={cn(
                                    "voice-selector-option min-w-[145px] items-start justify-start p-3 text-sm",
                                    field.value === voiceId &&
                                      "voice-selector-option-selected",
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name={field.name}
                                    value={voiceId}
                                    checked={field.value === voiceId}
                                    onChange={() => field.onChange(voiceId)}
                                    className="mt-1 accent-[#663820]"
                                  />
                                  <span>
                                    <span className="block font-semibold text-[#212a3b]">
                                      {voice.name}
                                    </span>
                                    <span className="text-xs text-[#3d485e]">
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
            <div className="flex justify-end gap-3 border-t border-[#d8cbb9] pt-5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="cursor-pointer rounded-lg border border-[#d8cbb9] px-4 py-2.5 text-sm font-semibold text-[#3d485e] hover:bg-[#f3e4c7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#663820] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#7a4528] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isSubmitting ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </Form>
      </section>
    </div>,
    document.body,
  );
};

export default EditWindow;
