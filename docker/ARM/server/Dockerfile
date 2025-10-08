FROM node:20-alpine

# Basis: Schlankes Alpine-Image mit aktueller Node 20 Runtime

# Benötigte Systemwerkzeuge für Build & Git-Klon
RUN apk add --no-cache bash git openssh curl gnupg tar

# (Info) Yarn ist im node:alpine Image bereits vorhanden – ENV bleibt folgenlos
ENV YARN_VERSION=1.22.15

# Klont den Quellcode (kein spezifischer Commit/Tag – für reproduzierbare Builds ggf. pinnen)
RUN git clone https://github.com/dwiegreffe/mdsrv.git

# fetch
# checkout

# Installiert alle JS/TS Abhängigkeiten (Produktions- & Dev-Abhängigkeiten für Build)
RUN cd mdsrv && npm install

# Baut den Code in das Verzeichnis lib/commonjs/... (NODE_ENV=production für optimierte Bundles)
RUN cd mdsrv && NODE_ENV=production npm run build

# Setzt das Arbeitsverzeichnis auf das geklonte Repository, damit nachfolgende Befehle kein 'cd' mehr benötigen
WORKDIR /mdsrv

# Exponierter Port des Remote Session / Trajectory Servers
EXPOSE 1337

# Startet den Remote-Session-Server (klarere Aufteilung ohne 'cd').
# Parameter:
#  --working-folder ./server   Pfad (relativ zum WORKDIR) für persistente Sitzungen/Trajektorien (Volume empfohlen)
#  --port 1337                 Server-Port
CMD ["node", "lib/commonjs/extensions/remote-session/server/index.js", "--working-folder", "./server", "--port", "1337"]