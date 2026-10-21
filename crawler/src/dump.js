// Debug aid: when a portal yields nothing, save what the browser actually saw (DUMP_DIR set by the workflow's
// debug option; GitHub keeps the files as a downloadable artifact for 3 days).
import { mkdir, writeFile } from "node:fs/promises";

export async function dumpPage(page, name, log = console.log) {
  const dir = process.env.DUMP_DIR;
  let title = "";
  try { title = await page.title(); } catch { /* page gone */ }
  log(`  ${name}: nothing found on "${title}" (${page.url()})`);
  // the page's tables in brief, so the log alone shows the real layout
  try {
    const tables = await page.$$eval("table", (ts) => ts.map((t, i) => {
      const rows = [...t.querySelectorAll("tr")];
      return { i, id: t.id || null, cls: t.className || null, rows: rows.length,
        sample: rows.slice(0, 4).map((r) => [...r.querySelectorAll("td,th")].map((c) => c.innerText.replace(/\s+/g, " ").trim().slice(0, 50))) };
    }).filter((t) => t.rows >= 3));
    for (const t of tables.slice(0, 12)) log(`    table#${t.i} id=${t.id} class=${t.cls} rows=${t.rows} ${JSON.stringify(t.sample)}`);
    const links = await page.$$eval("a", (as) => as.map((a) => a.innerText.trim()).filter((x) => /tender|next|more|view/i.test(x)).slice(0, 15));
    log(`    links: ${JSON.stringify(links)}`);
  } catch (e) { log(`    layout summary failed: ${e.message}`); }
  if (!dir) return;
  try {
    await mkdir(dir, { recursive: true });
    const file = `${dir}/${name.replace(/[^a-z0-9]+/gi, "_")}`;
    await writeFile(`${file}.html`, await page.content());
    await page.screenshot({ path: `${file}.png`, fullPage: true });
  } catch (e) { log(`  dump failed for ${name}: ${e.message}`); }
}
