FROM node:20-alpine

RUN apk add --no-cache bash git openssh curl gnupg tar

ENV YARN_VERSION=1.22.15

# Yarn ist bereits installiert, daher diesen Block entfernen!

RUN git clone https://github.com/dwiegreffe/mdsrv.git

RUN cd mdsrv && npm install

RUN cd mdsrv && NODE_ENV=production npm run build

EXPOSE 1337

CMD ["sh", "-c", "cd mdsrv && node lib/commonjs/extensions/remote-session/server/index.js --working-folder ./server --port 1337"]