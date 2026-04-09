# Model Query Definitions

## Summary
- This directory contains the reusable query definitions and parameter schemas for the model server.
- It exists to describe what structure queries mean independently of HTTP transport.
- `server/api.ts` and local query execution both build on these definitions.
- The main extension point is adding new query types or query parameter normalization helpers.

## What
- Defines how atom/residue/assembly-style queries are expressed.
- Maps request parameters to structure-query predicates.
- Holds schema-level pieces that are shared by HTTP and local execution paths.
- Does not execute HTTP requests or write responses.

## Why
- Query meaning should live in one place, not be duplicated across web and local APIs.
- This separation makes new query types easier to add and document.
- It also keeps route handlers thin and transport-focused.

## How
- **Use:** Add new structural query logic here before wiring it into server routes.
- **Use:** Keep parameter interpretation and predicate building close to each other.
- **Extend:** Favor pure query-building helpers that can be reused by both web and local modes.
- **Integrate:** Expose new queries through `server/api.ts` and related schema generation.
- **Watch out:** Transport concerns like Express request handling do not belong here.
