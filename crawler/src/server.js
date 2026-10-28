// Dhandha's Indian server (AWS Mumbai): everything the GitHub machines cannot do from abroad, in one container.
//   - the tender crawler (src/index.js, every INTERVAL_HOURS)
//   - the always-on document fetcher (src/docs.js --forever; captchas go to the admin's captcha desk)
//   - MCA's monthly new-company files (src/mca.js, daily at MCA_HOUR:MCA_MINUTE India time) — only with MCA=1:
//     MCA refuses cloud machines (403), so the working route is the owner's own computer (tools/mca-upload.sh)
// Each part runs as its own process and is restarted if it stops. SIGTERM / SIGINT (docker stop, Watchtower) are
// passed on to the children, and the server exits once they have stopped.
import { spawn } from "node:child_process";

const log = (...a) => console.log(new Date().toISOString(), "[server]", ...a);
const children = new Set();
let stopping = false;
function run(args, env) {
  const p = spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...env } });
  children.add(p);
  p.on("exit", () => { children.delete(p); if (stopping && !children.size) process.exit(0); });
  return p;
}
function keep(name, args) {
  const start = () => {
    if (stopping) return;
    log(`start ${name}`);
    const p = run(args, { RUNNER_NAME: `${process.env.RUNNER_NAME || "india-server"}-${name}` });
    p.on("exit", (code) => { if (stopping) return; log(`${name} stopped (${code}); restarting in 30 s`); setTimeout(start, 30000); });
  };
  start();
}

keep("crawler", ["src/index.js"]);
if (process.env.DOCS !== "0") keep("docs", ["src/docs.js", "--forever", "--hours", "100000"]);

// MCA once a day (India time), only when switched on with MCA=1; a file already loaded is skipped by mca.js itself
const H = Number(process.env.MCA_HOUR ?? 10), M = Number(process.env.MCA_MINUTE ?? 55);
let lastMca = null;
const runMca = () => { lastMca = new Date().toDateString(); log("MCA check"); run(["src/mca.js"], { RUNNER_NAME: "india-server-mca" }); };
if (process.env.MCA === "1") {
  setInterval(() => {
    if (stopping) return;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    if (now.getHours() === H && now.getMinutes() >= M && lastMca !== new Date().toDateString()) runMca();
  }, 60000);
}

// docker stop waits 10 s before killing: pass the signal on, give the children 8 s to put their work back
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => {
  if (stopping) return;
  stopping = true;
  log(`${sig}: stopping ${children.size} process(es)`);
  if (!children.size) process.exit(0);
  for (const p of children) p.kill(sig);
  setTimeout(() => { log("children did not stop in time; exiting"); process.exit(0); }, 8000).unref();
});
