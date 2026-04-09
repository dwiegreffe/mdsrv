# YAML Server

## Summary
- This directory contains the file-backed YAML CRUD server.
- It exists to create, read, update, rename, delete, list, and validate YAML documents in a working folder.
- The runtime entrypoint is `index.ts`.
- The main extension points are validation rules, storage layout, and API schema generation.

## What
- Stores YAML files under a server-managed data directory.
- Validates file names and YAML content before writes.
- Exposes a small HTTP API plus Swagger/OpenAPI docs.
- Loads optional validation rules from a JSON config file.
- Does not manage richer document workflows beyond validated file CRUD.

## Why
- This service provides a very small writable API without involving the heavier model or volume servers.
- The file-based design keeps operations transparent and easy to debug.
- Validation is configurable so deployments can enforce lightweight content rules without a database.

## How
- **Use:** Start `index.ts` with a working folder and optional port/API prefix/rules file.
- **Use:** YAML files are stored below the configured working folder in a dedicated files directory.
- **Extend:** Keep rule parsing and content validation in `yml.ts` and schema updates in `api-schema.ts`.
- **Extend:** If the runtime grows, split routing, storage, and validation before adding more endpoints.
- **Watch out:** This directory currently keeps too much runtime behavior in one entry file; avoid adding more responsibilities there.
