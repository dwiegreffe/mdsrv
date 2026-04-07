FROM node:16-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN NODE_ENV=production npm run build-tsc \
    && node docker/server/inject-request-logs.js /app/lib/commonjs/extensions/remote-session/server/index.js


FROM node:16-alpine AS remote-session-runtime

WORKDIR /app

COPY docker/runtime/remote-session.package.json ./package.json
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/lib/commonjs ./lib/commonjs

EXPOSE 1337

CMD ["node", "lib/commonjs/extensions/remote-session/server/index.js", "--working-folder", "/mdsrv/remote-session", "--port", "1337"]


FROM node:16-alpine AS yml-server-runtime

WORKDIR /app

COPY docker/runtime/yml-server.package.json ./package.json
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/lib/commonjs ./lib/commonjs
COPY docs/yml-rules.example.json ./docs/yml-rules.example.json

EXPOSE 1340

CMD ["node", "lib/commonjs/servers/yml-server/index.js", "--working-folder", "/mdsrv/yml-server", "--port", "1340", "--yml-rules", "/app/docs/yml-rules.example.json"]
