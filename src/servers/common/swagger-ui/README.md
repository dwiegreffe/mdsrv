# Swagger UI Integration

## Summary
- This directory provides the shared Swagger UI handlers used by HTTP servers in this repository.
- It exists so each server can expose docs without duplicating HTML/template wiring.
- `model`, `volume`, `plugin-state`, and `yml-server` use it for API docs pages.
- The entrypoints are `swaggerUiAssetsHandler` and `swaggerUiIndexHandler`.

## What
- Wraps `swagger-ui-dist` asset serving.
- Generates the HTML index page from a small template and options object.
- Centralizes the contract for title, OpenAPI URL, API prefix, and favicon handling.
- Does not build schemas or define routes for any specific API.

## Why
- Swagger setup is repetitive but not domain-specific.
- Keeping it shared makes docs behavior consistent across servers.
- The template-based approach keeps each server focused on its own schema and routes.

## How
- **Use:** Mount `swaggerUiAssetsHandler()` for static assets and `swaggerUiIndexHandler(...)` for the docs page.
- **Use:** Pass the server-specific OpenAPI JSON URL and title from the owning server.
- **Extend:** Change the shared template here when all server docs should change together.
- **Extend:** Keep API-specific schema generation outside this directory.
- **Watch out:** This directory serves the UI shell only; broken docs routes usually come from bad OpenAPI paths upstream.
