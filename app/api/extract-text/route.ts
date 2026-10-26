import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.NUTRIENT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "NUTRIENT_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A file is required." },
        { status: 400 },
      );
    }

    const form = new FormData();
    form.append("file", file, file.name);
    form.append(
      "instructions",
      JSON.stringify({
        mode: "auto",
        language: "auto-detect",
        output: {
          formats: ["spatial", "markdown"],
          includeWords: true,
        },
        instructions:
          "Extract the document faithfully. Preserve the exact wording, spelling, punctuation, paragraph breaks, headings, lists, quotations, tables, reading order, and page boundaries. Do not summarize, rewrite, correct, or invent text. Return Markdown with blank lines between blocks.",
      }),
    );

    const response = await fetch("https://api.nutrient.io/extraction/parse", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const message = await response.text();
      console.error("Nutrient extraction failed:", response.status, message);
      return NextResponse.json(
        { error: "The text extraction provider rejected the request." },
        { status: response.status },
      );
    }

    const result = await response.json();
    console.log(result.output?.markdown);
    return NextResponse.json({
      markdown: result.output?.markdown ?? "",
      output: result.output ?? {},
    });
  } catch (error) {
    console.error("Text extraction request failed:", error);
    return NextResponse.json(
      { error: "Could not extract text from the file." },
      { status: 500 },
    );
  }
}
