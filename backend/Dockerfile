FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./

FROM base AS development

RUN apk add --no-cache openssl libc6-compat

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3001

CMD ["/bin/sh", "-c", "if [ ! -f node_modules/.bin/nest ] || [ ! -d node_modules/ts-loader ]; then npm install; fi && npx prisma generate && npx prisma db push && npx prisma db seed && npm run start:dev"]

FROM base AS build

RUN apk add --no-cache openssl libc6-compat

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
