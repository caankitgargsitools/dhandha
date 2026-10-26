// Dhandha's Indian server: everything the GitHub machines cannot do from abroad, in one container.
//   - the tender crawler (src/index.js, every INTERVAL_HOURS)
//   - the always-on document fetcher (src/docs.js --forever; captchas go to the admin's captcha desk)
//   - MCA's monthly new-company files (src/mca.js, daily at MCA_HOUR:MCA_MINUTE India time)
// Each part runs as its own process and is restarted if it stops.
import { spawn } from "node:child_process";

const log = (...a) => console.log(new Date().toISOString(), "[server]", ...a);
function keep(name, args) {
  const start = () => {
    log(`start ${name}`);
    const p = spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env, RUNNER_NAME: `${process.env.RUNNER_NAME || "india-server"}-${name}` } });
    p.on("exit", (code) => { log(`${name} stopped (${code}); restarting in 30 s`); setTimeout(start, 30000); });
  };
  start();
}

keep("crawler", ["src/index.js"]);
if (process.env.DOCS !== "0") keep("docs", ["src/docs.js", "--forever", "--hours", "100000"]);

// MCA once a day (India time); a file already loaded is skipped by mca.js itself
const H = Number(process.env.MCA_HOUR ?? 10), M = Number(process.env.MCA_MINUTE ?? 55);
let lastMca = null;
const runMca = () => { lastMca = new Date().toDateString(); log("MCA check"); spawn(process.execPath, ["src/mca.js"], { stdio: "inherit", env: { ...process.env, RUNNER_NAME: "india-server-mca" } }); };
if (process.env.MCA !== "0") {
  setTimeout(runMca, 60000); // once soon after the server starts, then daily
  setInterval(() => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    if (now.getHours() === H && now.getMinutes() >= M && lastMca !== new Date().toDateString()) runMca();
  }, 60000);
}
