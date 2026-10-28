# Bookify

Bookify is a personal reading and research workspace for uploading books, reading them in the browser, and asking questions about their contents. It combines a searchable book library with document rendering, text extraction, and AI-powered text and voice conversations.

## Features

### Personal book library

- Sign up and sign in with Clerk.
- Browse books in a responsive library view.
- Search the library by book title or author.
- Open a book from its cover card to view its details and reader.
- Keep book data associated with the authenticated user.

### Book uploads and metadata

- Upload PDF, Microsoft Word (`.doc` and `.docx`), or plain-text (`.txt`) files.
- Upload an optional cover image, or use the default Bookify cover.
- Add and edit the title, author, description, and AI assistant voice for a book.
- Upload files securely through Vercel Blob.
- Files are limited to 50 MB. Cover images are limited to 10 MB.
- Prevent duplicate books with the same title.
- Edit or delete books from the book owner actions menu.

### In-browser reading

- Read uploaded PDFs with selectable text and page-aware rendering.
- Read Word documents directly in the browser.
- Navigate between pages with previous/next controls or by entering a page number.
- Automatically render only the relevant PDF pages first for a smoother reading experience.
- View file type, size, and other book file information on the details page.

### Ask questions about a book

- Ask questions about the currently opened book using text chat.
- Start a spoken conversation with the book using the microphone control.
- Mute and unmute the voice conversation.
- Use the book's stored assistant voice/persona for voice responses.
- Search the stored book segments to ground answers in the uploaded content.
- See the conversation transcript as the assistant responds.

### Text extraction

- Extract text from PDF, Word, and image files from the dedicated **Extract text** page.
- Preserve document structure, including headings, paragraphs, lists, tables, reading order, and page boundaries where available.
- Switch between structured/spatial output and Markdown output.
- Copy extracted output to the clipboard.

## Tech stack

- [Next.js](https://nextjs.org/) 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Clerk for authentication
- MongoDB with Mongoose for books, segments, and voice sessions
- Vercel Blob for uploaded files and cover images
- PDF.js for PDF reading
- `docx-preview` for Word document rendering
- Vapi and ElevenLabs voices for AI text/voice conversations
- Nutrient extraction API for standalone document text extraction
- Zod and React Hook Form for form validation

## Requirements

- Node.js 20 or newer
- npm
- A MongoDB database
- A Clerk application
- A Vercel Blob store
- A Vapi assistant configured for the `searchBook` tool
- A Nutrient API key for text extraction

## Getting started

The hosted url: https://bookify-29v6nfxzh-mantis-projects-59272058.vercel.app/

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# MongoDB
MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/bookify

# Vercel Blob
BLOB_READ_WRITE_TOKEN=your_vercel_blob_read_write_token

# Vapi
NEXT_PUBLIC_VAPI_API_KEY=your_vapi_public_api_key
NEXT_PUBLIC_ASSISTANT_ID=your_vapi_assistant_id

# Nutrient
NUTRIENT_API_KEY=your_nutrient_api_key
```

Do not commit `.env.local` or any API keys to source control. The Clerk variable names may also be supplied by the deployment platform when the Clerk integration is configured.

### 3. Configure the Vapi assistant

The assistant should be configured to call Bookify's book-search tool:

```text
POST /api/vapi/search-book
```

The tool accepts a `bookId` and a user `query`, then returns matching segments from the selected book. The assistant should pass the book ID supplied by the Bookify client when it invokes `searchBook`.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Main routes

| Route           | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `/`             | Browse and search the authenticated book library   |
| `/books/new`    | Upload a book and enter its metadata               |
| `/books/[slug]` | View book details, read the book, and chat with it |
| `/extract-text` | Extract structured text from a document or image   |
| `/sign-in`      | Clerk sign-in page                                 |
| `/sign-up`      | Clerk sign-up page                                 |

## Project structure

```text
app/
  (root)/                 Application pages
  api/                    Upload, extraction, and book-search endpoints
  hooks/                  Client hooks, including Vapi integration
components/               Reader, upload, library, chat, and form components
database/                 Mongoose connection and data models
lib/actions/              Server actions for books and voice sessions
lib/                      Validation, constants, and shared utilities
public/                   Static images and branding assets
```

## Data and access model

Book records and extracted book segments are stored in MongoDB. Uploaded files and cover images are stored in Vercel Blob. Clerk identifies the current user, and book details, editing, deletion, uploads, and voice sessions are scoped to that user.

The standalone extraction endpoint sends the selected file to Nutrient and returns the provider's Markdown and structured output. Configure the provider before using `/extract-text`.

## Production deployment

Build and run the application with:

```bash
npm run build
npm run start
```

Set all environment variables in the deployment platform before building. In addition, make sure the deployment can reach MongoDB, the Vercel Blob store is available, the Clerk application is configured for the production domain, and the Vapi assistant's `searchBook` tool points to the production `/api/vapi/search-book` endpoint.
