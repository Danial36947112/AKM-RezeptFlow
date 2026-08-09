FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
RUN npm install --workspace=backend
COPY backend ./backend
COPY data ./data
RUN npm run build --workspace=backend

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
RUN npm install --workspace=backend --omit=dev
COPY --from=build /app/backend/dist ./backend/dist
COPY data ./data
ENV PORT=3001
ENV DATABASE_PATH=/app/data/rezeptflow.db
ENV MOCK_ZOHO_PATH=/app/data/mock-zoho
ENV NODE_OPTIONS=--experimental-sqlite
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
