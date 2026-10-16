import UploadForm from "@/components/UploadForm";
import React from "react";

const Page = () => {
  return (
    <main className="wrapper container">
      <div className="mx-auto max-w-180 space-y-10">
        <section className="flex flex-col gap-5">
          <h1 className="page-title-xl">Add a New File</h1>
          <p className="subtitle">
            Upload a PDF, Word or txt file to your library.
          </p>
        </section>

        <UploadForm />
      </div>
    </main>
  );
};

export default Page;
