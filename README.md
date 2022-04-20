# MDsrv

## Introduction

MDsrv is a web tool for interactive and remote exploration of trajectories. Interactive visualization of MD trajectories provides an instant, transparent, and intuitive understanding of complex dynamics, while sharing of MD trajectories may generate transparency and trust, allowing collaboration, knowledge exchange, and data reuse.
## Install via docker

    Checkout Repo

    Build Viewer:
        Go to folder docker/viewer
        Run the following command: docker build --no-cache -t proteinvis/mdsrv-viewer .
        Start it with “docker run -p 80:4242 proteinvis/mdsrv-viewer https://remote.sca-ds.de”

        If you want to use a different streaming server as default, start it with

        “docker run -p 80:4242 dwiegreffe/mdsrv-viewer your-url.here”

    Build Remote Server:
        Go to folder docker/server
        Run the following command: docker build --no-cache -t proteinvis/mdsrv-remote .
        Start the container: docker run -p 1337:1337 -v /path/to/mdsrv/server:/mdsrv/server proteinvis/mdsrv-remote

Access the webservice at 127.0.0.1:4242
