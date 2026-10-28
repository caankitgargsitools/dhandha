# Built from the repository root (context .) so the shared readers in lib/ are inside the image.
FROM mcr.microsoft.com/playwright:v1.56.1-jammy
# Dhandha AI voice server (free, self-hosted; voice/server.py): Python with faster-whisper (ears), Piper (voices),
# webrtcvad (turn-taking) and a Cloudflare quick tunnel (no open ports). Models are fetched here, at build time
# (first, so crawler changes reuse these heavy layers).
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends python3-pip curl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && pip3 install --no-cache-dir "faster-whisper==1.2.1" "piper-tts==1.8.0" webrtcvad-wheels aiohttp numpy \
 && curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${TARGETARCH}" \
 && chmod +x /usr/local/bin/cloudflared
RUN mkdir -p /models/piper && cd /models/piper \
 && for v in hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium hi/hi_IN/pratham/medium/hi_IN-pratham-medium \
             en/en_US/lessac/medium/en_US-lessac-medium en/en_US/ryan/medium/en_US-ryan-medium; do \
      f=$(basename "$v"); \
      curl -fsSL -o "$f.onnx" "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/$v.onnx" \
        && curl -fsSL -o "$f.onnx.json" "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/$v.onnx.json" \
        || { echo "voice $f not available"; rm -f "$f.onnx" "$f.onnx.json"; }; \
    done && ls -la /models/piper \
 && python3 -c "from faster_whisper import download_model; download_model('base', output_dir='/models/whisper-base')"
WORKDIR /app/crawler
COPY crawler/package.json ./
RUN npm install --omit=dev
COPY crawler/src ./src
COPY lib/xlsx.js lib/mca.js /app/lib/
RUN echo '{"type":"module"}' > /app/lib/package.json
COPY voice /app/voice
ENV TZ=Asia/Kolkata
CMD ["node", "src/server.js"]
