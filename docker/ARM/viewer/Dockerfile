FROM node:20-alpine

# Basis-Image: Schlankes Alpine mit aktueller Node 20 Runtime

# Systemwerkzeuge für Build & Git-Klon
RUN apk add --no-cache bash git openssh curl gnupg tar

# Quellcode klonen (optional für reproducible builds: Commit oder Tag pinnen)
RUN git clone https://github.com/dwiegreffe/mdsrv.git

# Abhängigkeiten installieren
RUN cd mdsrv && npm install

# Produktionsbuild: erzeugt u.a. build/viewer/* (molstar Bundle etc.)
RUN cd mdsrv && NODE_ENV=production npm run build

# Globale Tools:
# - http-server: Serviert statische Dateien
# - forever: (aktuell nicht direkt genutzt, aber vorhanden für mögliche Prozessüberwachung)
RUN npm install -g http-server \
	&& npm install -g forever

# Viewer-Port
EXPOSE 4242

# Skript zum Umschreiben der Remote-Server-URL vor dem Start
COPY change-url.sh /
RUN chmod +x change-url.sh

# Übergibt beim Containerstart optional eine Zielbasis-URL, ersetzt Standard-URL im Bundle und startet http-server
ENTRYPOINT ["/change-url.sh"]