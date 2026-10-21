// Debug aid: when a portal yields nothing, save what the browser actually saw (DUMP_DIR set by the workflow's
// debug option; GitHub keeps the files as a downloadable artifact for 3 days).
import { mkdir, writeFile } from "node:fs/promises";

export async function dumpPage(page, name, log = console.log) {
  const dir = process.env.DUMP_DIR;
  let title = "";
  try { title = await page.title(); } catch { /* page gone */ }
  log(`  ${name}: nothing found on "${title}" (${page.url()})`);
  if (!dir) return;
  try {
    await mkdir(dir, { recursive: true });
    const file = `${dir}/${name.replace(/[^a-z0-9]+/gi, "_")}`;
    await writeFile(`${file}.html`, await page.content());
    await page.screenshot({ path: `${file}.png`, fullPage: true });
  } catch (e) { log(`  dump failed for ${name}: ${e.message}`); }
}
