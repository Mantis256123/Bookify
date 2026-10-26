"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import DeleteBookButton from "@/components/DeleteBookButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditWindow from "./EditWindow";

type BookActionsMenuProps = {
  bookId: string;
  title: string;
  description?: string;
  author: string;
  voice?: string;
  coverURL?: string;
};

export default function BookActionsMenu({
  bookId,
  title,
  description,
  author,
  voice,
  coverURL,
}: BookActionsMenuProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <div className="absolute right-4 top-4 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-[#d8cbb9] bg-white/80 text-[#3d485e] transition-colors hover:bg-white hover:text-[#212a3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#663820] data-popup-open:bg-white data-popup-open:text-[#212a3b]"
          aria-label="Book actions"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={() => setIsEditOpen(true)}
            className="cursor-pointer"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setIsDeleteOpen(true)}
            className="cursor-pointer"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteBookButton
        bookId={bookId}
        title={title}
        variant="menu"
        showTrigger={false}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
      <EditWindow
        bookId={bookId}
        initialValues={{ title, description, author, voice, coverURL }}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </div>
  );
}
