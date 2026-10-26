# Built from the repository root (context .) so the shared readers in lib/ are inside the image.
FROM mcr.microsoft.com/playwright:v1.56.1-jammy
WORKDIR /app/crawler
COPY crawler/package.json ./
RUN npm install --omit=dev
COPY crawler/src ./src
COPY lib/xlsx.js lib/mca.js /app/lib/
RUN echo '{"type":"module"}' > /app/lib/package.json
ENV TZ=Asia/Kolkata
CMD ["node", "src/server.js"]
