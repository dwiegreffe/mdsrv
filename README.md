# MDsrv

## Introduction

MDsrv is a web tool for interactive and remote exploration of trajectories. Interactive visualization of MD trajectories provides an instant, transparent, and intuitive understanding of complex dynamics, while sharing of MD trajectories may generate transparency and trust, allowing collaboration, knowledge exchange, and data reuse.

## Install via docker

    Checkout Repo

    Build Viewer:
        Go to folder docker/<your-architecture>/viewer
        Run the following command: docker build --no-cache -t proteinvis/mdsrv-viewer .
        Start it with “docker run -p 4242:4242 proteinvis/mdsrv-viewer https://remote.sca-ds.de”

        If you want to use a different streaming server as default, start it with

        “docker run -p 4242:4242 dwiegreffe/mdsrv-viewer your-url.here”

        Access the viewer at [http://127.0.0.1:4242](http://127.0.0.1:4242).

    Build Remote Server:
        Go to folder docker/<your-architecture>/server
        Run the following command: docker build --no-cache -t proteinvis/mdsrv-remote .
        Start the container: docker run -p 1337:1337 -v /path/to/mdsrv/server:/mdsrv/server proteinvis/mdsrv-remote
        for example: "docker run -p 1337:1337 -v ../../../server:/mdsrv/server proteinvis/mdsrv-remote"

Access the webservice at 127.0.0.1:4242

## Erläuterung der Docker-Images (Viewer & Remote Server)

Dieser Abschnitt erklärt, wie die beiden bereitgestellten Docker-Images aufgebaut sind und zusammenspielen. Es gibt zwei getrennte Container:

1. Viewer: Liefert die Web-Oberfläche (statische Dateien) aus.
2. Remote Session / Trajectory Server: Stellt Sitzungen, Trajektorien-Streaming und serverseitige Funktionen bereit.

### Viewer Image
Pfad: `docker/<arch>/viewer/Dockerfile` (Beispiel ARM: `docker/ARM/viewer/Dockerfile`)

Wichtigste Schritte im Dockerfile:
- Basis-Image: `node:20-alpine` (klein, aktuelle Node-Version)
- Systemtools: Installation von `bash`, `git`, `openssh`, `curl`, `gnupg`, `tar`
- Repository-Klon: `git clone https://github.com/dwiegreffe/mdsrv.git`
- Abhängigkeiten: `npm install`
- Produktionsbuild: `NODE_ENV=production npm run build` erzeugt u.a. `build/viewer/`
- Globale Tools: `http-server` (für statische Auslieferung). `forever` ist installiert, wird aber im Standard-Entrypoint nicht genutzt.
- Skript `change-url.sh`: Wird als `ENTRYPOINT` gesetzt. Es nimmt das erste Argument (die Basis-URL des Remote-Servers) entgegen, ersetzt den Standardwert `https://remote.sca-ds.de` direkt in der Datei `mdsrv/build/viewer/molstar.js` via `sed` und startet danach `http-server` auf Port `4242`.

Start (mit eigenem Remote-Server, z. B. lokal):
```bash
docker run -p 80:4242 proteinvis/mdsrv-viewer http://localhost:1337
```
Danach ist der Viewer unter `http://127.0.0.1:80` erreichbar.

Hinweise:
- Wird kein Argument übergeben, bleibt die Standard-URL unverändert (Verbindung geht an `https://remote.sca-ds.de`).
- Für wiederholtes Umschalten der Ziel-URL Container einfach neu starten mit neuem Parameter.

### Remote Session / Trajectory Server Image
Pfad: `docker/<arch>/server/Dockerfile` (Beispiel ARM: `docker/ARM/server/Dockerfile`)

Ablauf:
- Basis & Tools analog zum Viewer
- Klonen & Installieren (`npm install`)
- Build (`NODE_ENV=production npm run build`)
- Exposed Port: `1337`
- Startkommando: 
    ```bash
    node lib/commonjs/extensions/remote-session/server/index.js --working-folder ./server --port 1337
    ```

Persistenz:
Der Parameter `--working-folder ./server` verweist innerhalb des Containers auf `mdsrv/server` (Pfad relativ zum Startverzeichnis). Mounten Sie diesen Ordner als Volume, um Sitzungen/Trajektoriendateien außerhalb des Containers vorzuhalten:
```bash
docker run -p 1337:1337 \
    -v /lokaler/pfad/mdsrv/server:/mdsrv/server \
    proteinvis/mdsrv-remote
```

### Zusammenspiel
- Der Viewer (Port 4242) schickt API-/WebSocket-Anfragen an den Remote-Server (Port 1337), basierend auf der zur Laufzeit per `change-url.sh` gesetzten Basis-URL.
- Sie können mehrere Viewer-Instanzen starten, die denselben Remote-Server referenzieren.
- Ein Reverse Proxy (z. B. Nginx oder Traefik) kann beide Dienste unter einer gemeinsamen Domain bündeln (z. B. `/` für Viewer, `/api` für Server).

### Typische Port-Mappings
- Viewer: Intern 4242 → extern z. B. 80
- Remote Server: Intern 1337 → extern z. B. 1337

### Kurze Fehlerbehebung
- Viewer zeigt keine Daten: Prüfen, ob die angegebene Remote-URL erreichbar ist und CORS (falls Proxy) korrekt konfiguriert ist.
- Änderungen an URL greifen nicht: Sicherstellen, dass beim Start tatsächlich ein Argument übergeben wurde; sonst bleibt Standardwert erhalten.
- Persistenz fehlt: Volume-Mount für `server`-Ordner ergänzen.

### Sicherheitshinweise
- Für öffentlich erreichbare Setups HTTPS voranstellen (Reverse Proxy + Zertifikate, z. B. Let's Encrypt).
- Netzwerkzugriff auf den Remote-Server begrenzen, falls sensible oder unveröffentlichte Trajektorien genutzt werden.

---

Diese Erläuterung ergänzt die obenstehende Kurz-Anleitung und soll helfen, Images gezielt anzupassen oder in Produktionsumgebungen einzubetten.
