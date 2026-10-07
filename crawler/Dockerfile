FROM mcr.microsoft.com/playwright:v1.56.1-jammy
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV TZ=Asia/Kolkata
CMD ["node", "src/index.js"]
