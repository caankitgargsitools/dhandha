"""Dhandha AI voice server (runs on the Mumbai server next to the crawler).

A browser "test call" connects over a WebSocket and streams the microphone (16 kHz mono PCM16). This server:
  ears   — webrtcvad finds when the person starts / stops talking; faster-whisper (free, CPU) writes down what they said
  brain  — Dhandha's /api/voice/turn decides the next line (the playbook's script, goal and language)
  voice  — Piper (free, CPU) speaks it in a female or male Hindi / English voice; audio streams back to the browser
The person can interrupt (barge-in): new speech while Dhandha AI talks stops the playback.
Models load on the first call and are let go after 10 quiet minutes, so the small server keeps its memory for the crawler.
It is reached through a free Cloudflare quick tunnel (no open ports); the tunnel's address is reported to Dhandha.
Testing only: no phone line yet — a TRAI-registered number comes before calling the public.
"""
import asyncio, gc, json, os, re, subprocess, threading, time, urllib.request

import numpy as np
from aiohttp import web, ClientSession, ClientTimeout
import webrtcvad

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
PUB_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
INGEST_KEY = os.environ["INGEST_KEY"]
DHANDHA_URL = os.environ.get("DHANDHA_URL", "https://dhandha-amber.vercel.app").rstrip("/")
PORT = int(os.environ.get("VOICE_PORT", "8090"))
MODELS = os.environ.get("VOICE_MODELS", "/models")
WHISPER = os.environ.get("WHISPER_MODEL", "base")  # tiny / base / small — bigger hears better but is slower on a CPU
IDLE_UNLOAD = 600
RATE = 16000
FRAME = 480  # 30 ms at 16 kHz
VOICES = {  # (language, gender) → Piper model file; missing ones fall back to any voice that is present
    ("hi", "female"): "hi_IN-priyamvada-medium.onnx", ("hi", "male"): "hi_IN-pratham-medium.onnx",
    ("en", "female"): "en_US-lessac-medium.onnx", ("en", "male"): "en_US-ryan-medium.onnx",
}

def log(*a):
    print(time.strftime("%Y-%m-%dT%H:%M:%S"), "[voice]", *a, flush=True)


# ---------- models, loaded only while calls happen ----------
class Models:
    def __init__(self):
        self.lock = threading.Lock()
        self.stt = None
        self.voices = {}
        self.used = 0.0

    def ear(self):
        with self.lock:
            if self.stt is None:
                from faster_whisper import WhisperModel
                path = os.path.join(MODELS, f"whisper-{WHISPER}")
                self.stt = WhisperModel(path if os.path.isdir(path) else WHISPER, device="cpu", compute_type="int8", cpu_threads=2)
                log("speech-to-text loaded:", WHISPER)
            self.used = time.time()
            return self.stt

    def voice(self, lang, gender):
        with self.lock:
            name = VOICES.get((lang, gender))
            files = [name] + [v for v in VOICES.values() if v != name]
            for f in files:
                p = os.path.join(MODELS, "piper", f or "")
                if f and os.path.exists(p):
                    if f not in self.voices:
                        from piper import PiperVoice
                        self.voices[f] = PiperVoice.load(p)
                        log("voice loaded:", f)
                    self.used = time.time()
                    return self.voices[f]
            raise RuntimeError("no Piper voice is installed")

    def unload_if_idle(self, live):
        with self.lock:
            if live == 0 and (self.stt or self.voices) and time.time() - self.used > IDLE_UNLOAD:
                self.stt, self.voices = None, {}
                gc.collect()
                log("models unloaded (idle)")

M = Models()
LIVE = {"n": 0}


def transcribe(pcm: bytes) -> str:
    audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
    segs, _ = M.ear().transcribe(audio, beam_size=1, language=None, vad_filter=False, condition_on_previous_text=False,
                                 initial_prompt="Namaste. Haan ji, boliye. GST, audit, meeting, kal, theek hai.")
    return " ".join(s.text.strip() for s in segs).strip()


def speak(text: str, lang: str, gender: str):
    """Returns (sample_rate, PCM16 bytes)."""
    v = M.voice(lang, gender)
    rate = getattr(getattr(v, "config", None), "sample_rate", 22050)
    if hasattr(v, "synthesize_stream_raw"):  # piper-tts 1.2
        return rate, b"".join(v.synthesize_stream_raw(text))
    chunks = list(v.synthesize(text))  # piper-tts 1.3+: AudioChunk objects
    if chunks and hasattr(chunks[0], "sample_rate"):
        rate = chunks[0].sample_rate
    return rate, b"".join(c.audio_int16_bytes for c in chunks)


# ---------- Dhandha (database + the turn route) ----------
async def rpc(http, fn, body):
    async with http.post(f"{SUPABASE_URL}/rest/v1/rpc/{fn}", json={"p_key": INGEST_KEY, **body},
                         headers={"apikey": PUB_KEY, "content-type": "application/json"}) as r:
        t = await r.text()
        if r.status >= 300:
            raise RuntimeError(f"{fn} {r.status} {t[:200]}")
        return json.loads(t) if t else None


async def turn(http, token, history, heard):
    try:
        async with http.post(f"{DHANDHA_URL}/api/voice/turn", json={"token": token, "history": history, "heard": heard},
                             headers={"x-ingest-key": INGEST_KEY}, timeout=ClientTimeout(total=25)) as r:
            if r.status == 200:
                return await r.json()
            log("turn", r.status, (await r.text())[:200])
    except Exception as e:  # noqa: BLE001
        log("turn failed", e)
    return {"reply": "Sorry, I could not hear that clearly. Could you please say it again?", "lang": "en", "end": False}


# ---------- one call ----------
async def call(request):
    token = request.query.get("token", "")
    if not re.fullmatch(r"[0-9a-f-]{36}", token):
        raise web.HTTPForbidden()
    http = request.app["http"]
    session = await rpc(http, "voice_session_get", {"p_token": token})
    if not session:
        raise web.HTTPForbidden()
    cfg = session.get("config") or {}
    gender = "male" if cfg.get("voice") == "male" else "female"
    ws = web.WebSocketResponse(max_msg_size=4 * 1024 * 1024, heartbeat=20)
    await ws.prepare(request)
    LIVE["n"] += 1
    loop = asyncio.get_running_loop()
    history, outcome, summary = [], None, None
    t0 = loop.time()
    who_ended = {"v": "client"}  # the client hangs up unless Dhandha AI ends the call
    vad = webrtcvad.Vad(2)
    state = {"speaking": False, "cancel": False}
    log("call start", token[:8])

    async def say(text, lang):
        state["speaking"], state["cancel"] = True, False
        await ws.send_json({"type": "ai", "text": text})
        try:
            rate, pcm = await loop.run_in_executor(None, speak, text, lang, gender)
        except Exception as e:  # noqa: BLE001
            log("tts failed", e)
            state["speaking"] = False
            return
        await ws.send_json({"type": "audio", "rate": rate})
        step = rate // 5 * 2  # 200 ms per message, so an interruption stops it quickly
        for i in range(0, len(pcm), step):
            if state["cancel"] or ws.closed:
                break
            await ws.send_bytes(pcm[i:i + step])
            await asyncio.sleep(0.15)
        if not ws.closed:
            await ws.send_json({"type": "audio_end"})
        state["speaking"] = False

    async def respond(heard):
        nonlocal outcome, summary
        await ws.send_json({"type": "thinking"})
        t = await turn(http, token, history, heard)
        at = round(loop.time() - t0, 1)
        if heard:
            history.append({"role": "client", "text": heard, "at": at})
        # what the call-learning page reads: when it was said, whether the client cut in, whether the call ended here
        history.append({"role": "ai", "text": t.get("reply", ""), "at": at})
        outcome = t.get("outcome") or outcome
        summary = t.get("summary") or summary
        await say(t.get("reply", ""), t.get("lang", "en"))
        return t.get("end") is True

    ended = {"v": False}
    current = {"task": None}

    async def handle(pcm=None):
        heard = ""
        if pcm is not None:
            await ws.send_json({"type": "hearing"})
            heard = await loop.run_in_executor(None, transcribe, pcm)
            if not heard:
                return
            await ws.send_json({"type": "heard", "text": heard})
        if await respond(heard):
            ended["v"] = True
            who_ended["v"] = "ai"
            await asyncio.sleep(0.5)
            if not ws.closed:
                await ws.send_json({"type": "end"})
                await ws.close()

    async def start(pcm=None):
        # the reply runs in the background so the microphone keeps being read (that is how interruptions work);
        # a new turn waits for the previous one, whose speech has already been stopped
        prev = current["task"]
        if prev and not prev.done():
            state["cancel"] = True
            await prev
        current["task"] = asyncio.create_task(handle(pcm))

    try:
        await ws.send_json({"type": "ready"})
        await start()  # the opening line: "Namaste, I am Dhandha AI…"
        buf, speech, silence, voiced = bytearray(), bytearray(), 0, 0
        async for msg in ws:
            if ended["v"]:
                break
            if msg.type == web.WSMsgType.TEXT:
                if json.loads(msg.data or "{}").get("type") == "hangup":
                    break
                continue
            if msg.type != web.WSMsgType.BINARY:
                continue
            buf += msg.data
            while len(buf) >= FRAME * 2:
                frame, buf = bytes(buf[:FRAME * 2]), buf[FRAME * 2:]
                if vad.is_speech(frame, RATE):
                    voiced += 1
                    silence = 0
                    speech += frame
                    # barge-in: ~0.36 s of real speech while Dhandha AI is talking stops it
                    if state["speaking"] and voiced >= 12 and not state["cancel"]:
                        state["cancel"] = True
                        if history and history[-1]["role"] == "ai":
                            history[-1]["interrupted"] = True
                        await ws.send_json({"type": "stop"})
                elif speech:
                    silence += 1
                    speech += frame
                    if silence >= 23:  # ~0.7 s of quiet ends the person's turn
                        if voiced >= 10:  # at least ~0.3 s of speech, else it was noise
                            await start(bytes(speech))
                        speech, silence, voiced = bytearray(), 0, 0
                if len(speech) > RATE * 2 * 25:  # never hold more than 25 s
                    speech, silence, voiced = bytearray(), 0, 0
        if current["task"]:
            state["cancel"] = True
            await asyncio.wait([current["task"]], timeout=5)
    except Exception as e:  # noqa: BLE001
        log("call error", e)
    finally:
        LIVE["n"] -= 1
        try:
            await rpc(http, "voice_session_end", {"p_token": token, "p_transcript": history, "p_outcome": outcome, "p_summary": summary,
                                                  "p_ended_by": who_ended["v"]})
        except Exception as e:  # noqa: BLE001
            log("end report failed", e)
        if not ws.closed:
            await ws.close()
        log("call end", token[:8], len(history), "lines")
    return ws


async def health(_request):
    return web.json_response({"ok": True, "live": LIVE["n"], "loaded": bool(M.stt or M.voices)})


# ---------- the tunnel and housekeeping ----------
def tunnel(app):
    """Starts a Cloudflare quick tunnel and reports its https address to Dhandha whenever it (re)starts."""
    def run():
        while True:
            p = subprocess.Popen(["cloudflared", "tunnel", "--no-autoupdate", "--url", f"http://localhost:{PORT}"],
                                 stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)
            for line in p.stderr:
                m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
                if m:
                    url = m.group(0)
                    log("tunnel:", url)
                    try:
                        req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/rpc/voice_report", method="POST",
                                                     data=json.dumps({"p_key": INGEST_KEY, "p_url": url}).encode(),
                                                     headers={"apikey": PUB_KEY, "content-type": "application/json"})
                        urllib.request.urlopen(req, timeout=20).read()
                    except Exception as e:  # noqa: BLE001
                        log("report failed", e)
            p.wait()
            log("tunnel stopped; restarting in 10 s")
            time.sleep(10)
    threading.Thread(target=run, daemon=True).start()


async def housekeeping(_app):
    while True:
        await asyncio.sleep(60)
        M.unload_if_idle(LIVE["n"])


async def on_start(app):
    app["http"] = ClientSession(timeout=ClientTimeout(total=30))
    app["bg"] = asyncio.create_task(housekeeping(app))
    tunnel(app)


async def on_stop(app):
    app["bg"].cancel()
    await app["http"].close()


def main():
    app = web.Application()
    app.router.add_get("/ws", call)
    app.router.add_get("/health", health)
    app.on_startup.append(on_start)
    app.on_cleanup.append(on_stop)
    log("listening on", PORT)
    web.run_app(app, host="127.0.0.1", port=PORT, print=None)


if __name__ == "__main__":
    main()
