import { z } from "zod";
import { MAX_FILE_SIZE, MAX_IMAGE_SIZE } from "@/lib/constants";

const BOOK_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const BOOK_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const COVER_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

export const UploadSchema = z.object({
  bookFile: z
    .instanceof(File, { message: "A PDF, Word, or txt file is required." })
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "The book file must be smaller than 50MB.",
    })
    .refine((file) => {
      const extension = file.name
        .toLowerCase()
        .slice(file.name.lastIndexOf("."));
      return (
        BOOK_TYPES.includes(file.type) || BOOK_EXTENSIONS.includes(extension)
      );
    }, "Only PDF, Word, and TXT files are supported."),
  coverFile: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_IMAGE_SIZE, {
      message: "The cover image must be smaller than 10MB.",
    })
    .refine(
      (file) => {
        const extension = file.name
          .toLowerCase()
          .slice(file.name.lastIndexOf("."));
        return (
          file.type.startsWith("image/") || COVER_EXTENSIONS.includes(extension)
        );
      },
      {
        message:
          "Only PNG, JPG, JPEG, GIF, WEBP, and SVG images are supported.",
      },
    )
    .optional(),
  title: z.string().trim().min(1, "Title is required."),
  author: z.string().trim().min(1, "Author name is required."),
  voice: z.string().min(1, "Choose an assistant voice."),
});
