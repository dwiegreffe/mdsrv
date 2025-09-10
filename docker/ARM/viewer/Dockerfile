FROM node:20-alpine

# Yarn ist bereits installiert, daher diesen Block entfernen!

RUN apk add --no-cache bash git openssh curl gnupg tar

RUN git clone https://github.com/dwiegreffe/mdsrv.git

RUN cd mdsrv && npm install

RUN cd mdsrv && NODE_ENV=production npm run build

RUN npm install -g http-server 
RUN npm install -g forever

EXPOSE 4242

COPY change-url.sh /
RUN chmod +x change-url.sh

ENTRYPOINT ["/change-url.sh"]