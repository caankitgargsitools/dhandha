import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

// Free, in-process text extraction. Returns text per page; a page with almost no text is likely scanned.
export async function pdfPages(bytes) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  // Postgres refuses NUL characters in text and jsonb ("unsupported Unicode escape sequence"); some PDFs carry them
  const pages = (Array.isArray(text) ? text : [text]).map((p) => String(p ?? "").replace(/\u0000/g, ""));
  const chars = pages.reduce((s, p) => s + p.trim().length, 0);
  const scanned = pages.length > 0 && chars / pages.length < 80;
  return { pages, chars, scanned, pageCount: pdf.numPages };
}
