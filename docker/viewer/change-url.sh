#!/bin/sh
echo "$1"

sed -i "s,https://remote.sca-ds.de,$1,g" mdsrv/build/viewer/molstar.js

cd mdsrv/build/viewer && http-server -p 4242
