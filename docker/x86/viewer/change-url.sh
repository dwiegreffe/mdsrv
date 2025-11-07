#!/bin/sh

# Script to update the remote server URL in Mol* viewer and serve it locally.
# Allows switching between different backends without rebuilding.

# Print the provided URL for verification.
echo "$1"

# Replace the hardcoded remote URL in the viewer JS file with the new URL.
sed -i "s,https://remote.sca-ds.de,$1,g" mdsrv/build/viewer/molstar.js

# Change to the viewer directory and start a local HTTP server on port 4242.
cd mdsrv/build/viewer && http-server -p 4242
