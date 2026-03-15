FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY canvas-scraper-backend.js ./
COPY canvas-scraper.html ./
COPY canvas-device-merger.html ./

CMD ["node", "canvas-scraper-backend.js"]
