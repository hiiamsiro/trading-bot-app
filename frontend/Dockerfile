FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./

FROM base AS development

RUN npm install

COPY . .

EXPOSE 3000

# Bind-mount overwrites /app but anonymous volume keeps /app/node_modules from the image.
# Run npm install on start so new dependencies (e.g. from an updated package.json on the host) are present.
CMD ["sh", "-c", "npm install && exec npm run dev"]

FROM base AS build

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV production

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
