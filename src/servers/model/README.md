# Model Server

## Summary
- This directory contains the Mol* model/structure server and its related CLI tools.
- It exists to query structural data, preprocess source files, and attach extra model properties.
- HTTP consumers use `server.ts`; local batch use goes through `query.ts` and `preprocess.ts`.
- The main extension points are query definitions, property providers, and web/local API layers.

## What
- Serves structure queries over HTTP.
- Supports local batch execution of the same query model.
- Preprocesses CIF data into server-friendly outputs.
- Attaches extra properties from external sources such as PDBe and wwPDB.
- Does not handle density/volume data; that lives in `../volume`.

## Why
- Structure queries and preprocessing have substantial domain logic and deserve their own server family.
- The split between HTTP, local execution, preprocessing, and property enrichment keeps concerns separate.
- This server acts as the structure-focused counterpart to the volume server.

## How
- **Use:** Start `server.ts` for the HTTP API.
- **Use:** Run `query.ts` for local job-file based queries and `preprocess.ts` for CIF preprocessing workflows.
- **Extend:** Add or change query definitions in `query/` and the server API mapping in `server/`.
- **Extend:** Add new property sources through `properties/` and `property-provider.ts`.
- **Integrate:** Shared Swagger UI comes from `../common/swagger-ui`.
- **Watch out:** Keep entrypoints thin; most domain behavior belongs in `server/`, `query/`, `preprocess/`, or `properties/`.
