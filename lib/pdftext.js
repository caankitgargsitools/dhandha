import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

// Free, in-process text extraction. Returns text per page; a page with almost no text is likely scanned.
export async function pdfPages(bytes) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const chars = pages.reduce((s, p) => s + p.trim().length, 0);
  const scanned = pages.length > 0 && chars / pages.length < 80;
  return { pages, chars, scanned, pageCount: pdf.numPages };
}
