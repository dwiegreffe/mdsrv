# Swagger UI Integration

## Summary
- Provides shared Swagger UI handlers for backend services.
- Exists so services can expose docs without duplicating HTML/template setup.
- Entry points are `swaggerUiAssetsHandler` and `swaggerUiIndexHandler`.
- API schemas remain owned by each service.

## What
- Wraps `swagger-ui-dist` asset serving.
- Generates a small docs index page from service-specific options.
- Centralizes title, OpenAPI URL, API prefix, and favicon handling.
- Does not define routes or schemas for any concrete API.

## Why
- Swagger UI setup is repetitive but not domain-specific.
- Shared handlers keep docs behavior consistent.
- Template-based wiring lets services focus on their own schema and routes.

## How
- **Use:** mount `swaggerUiAssetsHandler()` for assets.
- **Use:** mount `swaggerUiIndexHandler(...)` for the docs page.
- **Extend:** change the shared template only when all service docs should change together.
- **Watch out:** broken docs usually come from bad OpenAPI paths or routes in the owning service.
