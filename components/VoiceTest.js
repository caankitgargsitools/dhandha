"use client";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/Progress";
import { startVoiceTest } from "@/app/app/leads/playbook/actions";

// A test call with Dhandha AI from the browser (no telephone number yet): the microphone is streamed to our own
// voice server as 16 kHz PCM16, and its replies come back as PCM16 audio that is played as it arrives. Speaking while
// Dhandha AI talks interrupts it (the server sends "stop").
const RATE = 16000;

function downsample(input, from) {
  if (from === RATE) return input;
  const ratio = from / RATE, out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += input[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

const pcm16 = (f) => {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff;
  return out.buffer;
};

const STATE = { connecting: "Connecting to Dhandha AI…", thinking: "Dhandha AI is thinking…", speaking: "Dhandha AI is speaking — you can interrupt", listening: "Listening — speak now", ended: "Call ended" };

export default function VoiceTest({ sequenceId, step, onClose }) {
  const [state, setState] = useState("connecting");
  const [lines, setLines] = useState([]);
  const [error, setError] = useState(null);
  const r = useRef({});
  const box = useRef(null);

  useEffect(() => {
    let dead = false;
    const add = (who, text) => setLines((l) => [...l, { who, text }]);
    const stopAudio = () => { for (const s of r.current.sources || []) try { s.stop(); } catch {} r.current.sources = []; r.current.at = 0; };

    (async () => {
      const s = await startVoiceTest(sequenceId, step);
      if (dead) return;
      if (s.error) { setError(s.error); setState("ended"); return; }
      let mic;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      } catch { setError("Please allow the microphone for this test call."); setState("ended"); return; }
      if (dead) { mic.getTracks().forEach((t) => t.stop()); return; }
      const ctx = new AudioContext();
      const ws = new WebSocket(`${s.url.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(s.token)}`);
      ws.binaryType = "arraybuffer";
      Object.assign(r.current, { mic, ctx, ws, sources: [], at: 0 });

      const src = ctx.createMediaStreamSource(mic);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => { if (ws.readyState === 1) ws.send(pcm16(downsample(e.inputBuffer.getChannelData(0), ctx.sampleRate))); };
      const mute = ctx.createGain(); mute.gain.value = 0;
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      r.current.proc = proc;

      let rate = 22050;
      ws.onmessage = (m) => {
        if (typeof m.data !== "string") {
          const i16 = new Int16Array(m.data), f = new Float32Array(i16.length);
          for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 0x8000;
          const buf = ctx.createBuffer(1, f.length, rate);
          buf.copyToChannel(f, 0);
          const node = ctx.createBufferSource();
          node.buffer = buf; node.connect(ctx.destination);
          const at = Math.max(ctx.currentTime + 0.05, r.current.at || 0);
          node.start(at); r.current.at = at + buf.duration;
          r.current.sources.push(node);
          node.onended = () => { r.current.sources = r.current.sources.filter((x) => x !== node); };
          return;
        }
        const ev = JSON.parse(m.data);
        if (ev.type === "audio") { rate = ev.rate || rate; setState("speaking"); }
        else if (ev.type === "audio_end") setTimeout(() => setState((x) => (x === "speaking" ? "listening" : x)), Math.max(0, ((r.current.at || 0) - ctx.currentTime) * 1000));
        else if (ev.type === "stop") { stopAudio(); setState("listening"); }
        else if (ev.type === "thinking") setState("thinking");
        else if (ev.type === "hearing") setState("thinking");
        else if (ev.type === "ai") add("ai", ev.text);
        else if (ev.type === "heard") ev.text && add("you", ev.text);
        else if (ev.type === "end") setTimeout(() => ws.close(), Math.max(0, ((r.current.at || 0) - ctx.currentTime) * 1000) + 300);
      };
      ws.onerror = () => setError("Could not reach the Dhandha AI voice server. It may be restarting — try again in a minute.");
      ws.onclose = () => { setState("ended"); proc.disconnect(); mic.getTracks().forEach((t) => t.stop()); };
    })();

    return () => {
      dead = true;
      const { ws, mic, ctx, proc } = r.current;
      try { ws?.readyState === 1 && ws.send(JSON.stringify({ type: "hangup" })); ws?.close(); } catch {}
      proc?.disconnect(); mic?.getTracks().forEach((t) => t.stop()); ctx?.close().catch(() => {});
    };
  }, [sequenceId, step]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lines]);

  const hangUp = () => {
    const { ws } = r.current;
    try { ws?.send(JSON.stringify({ type: "hangup" })); ws?.close(); } catch {}
    setState("ended");
  };

  return (
    <div className="panel" style={{ marginTop: 10, background: "var(--surface-2, var(--bg))" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong className="small">📞 Test call · {STATE[state]}</strong>
        {state !== "ended" ? <button type="button" className="sm" onClick={hangUp} style={{ background: "var(--bad)" }}>Hang up</button>
          : <button type="button" className="ghost sm" onClick={onClose}>Close</button>}
      </div>
      {["connecting", "thinking"].includes(state) && <div style={{ marginTop: 8 }}><Spinner label={STATE[state]} /></div>}
      {error && <div className="notice" style={{ marginTop: 8 }}>{error}</div>}
      <div ref={box} className="stack-sm" style={{ maxHeight: 260, overflowY: "auto", marginTop: 8 }}>
        {lines.map((l, i) => (
          <div key={i} className="small" style={{ textAlign: l.who === "ai" ? "left" : "right" }}>
            <span className="tiny faint">{l.who === "ai" ? "Dhandha AI" : "You"}</span><div>{l.text}</div>
          </div>
        ))}
      </div>
      <p className="tiny faint" style={{ margin: "8px 0 0" }}>A test from your browser with free voices on our own server — replies can take a few seconds on the small test server. Use headphones for the clearest result.</p>
    </div>
  );
}
