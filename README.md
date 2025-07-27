# openapi-ts-server

Create a type-safe HTTP server from OpenAPI schemas using TypeScript.

## Features

- 🔷 **Type-safe** - Full TypeScript type safety using `openapi-typescript` generated types
- 🚀 **Zero runtime dependencies** - Only uses `openapi-typescript-helpers` at runtime
- 🔧 **Framework agnostic** - Works with Node.js, Deno, Bun, and any Web API compatible environment
- 📝 **OpenAPI compliant** - Generate TypeScript types directly from your OpenAPI schema
- 🎯 **Smart routing** - Automatic path parameter extraction with priority-based route matching
- 🔍 **IntelliSense support** - Get full autocomplete for paths, parameters, and response types

## Installation

```bash
npm install openapi-ts-server
# or
pnpm add openapi-ts-server
# or
yarn add openapi-ts-server
```

You'll also need `openapi-typescript` to generate types from your OpenAPI schema.

## Quick Start

### 1. Generate TypeScript types from your OpenAPI schema

```bash
npx openapi-typescript ./path/to/your/openapi.yaml -o ./schema.ts
```

### 2. Create your server

```typescript
import type { paths } from "./schema.ts";
import { createHandler } from "openapi-ts-server";

// Example data store
const users = [
  { id: "1", name: "John Doe", email: "john@example.com" },
  { id: "2", name: "Jane Smith", email: "jane@example.com" }
];

const handler = createHandler<paths>((ctx) => [
  // GET /users - List all users
  ctx.GET("/users", (_, c) => 
    c.jsonResponse(200, { users })
  ),
  
  // POST /users - Create a new user
  ctx.POST("/users", async (req, c) => {
    const user = await req.json(); // Fully typed based on OpenAPI schema (Not validated)
    users.push(user);
    return c.jsonResponse(201, user);
  }),
  
  // GET /users/{id} - Get user by ID
  ctx.GET("/users/{id}", (req, c) => {
    const { id } = c.params.path; // Type-safe path parameters
    const user = users.find((u) => u.id === id);
    if (!user) {
      return c.jsonResponse(404, { error: "User not found" });
    }
    return c.jsonResponse(200, user);
  }),
]);
```

### 3. Start your server

### Node.js

```typescript
import { createServer } from "http";
import { createRequestListener } from "@remix-run/node-fetch-server"; // Convert handler for Node.js
const server = createServer(createRequestListener(handler));
server.listen(3000);
```

### Deno

```typescript
Deno.serve({ port: 3000 }, handler);
```

### Bun

```typescript
Bun.serve({ fetch: handler, port: 3000 });
```

### Vite dev server

You can use it to build mock APIs.

```typescript
import { defineConfig } from "vite";
import { devApi } from "vite-plugin-dev-api";
export default defineConfig({
  plugins: [devApi({ fetch: handler, nextIf404: true })],
});
```

## API Reference

### `createHandler<Paths>(generator, options?)`

Creates a type-safe request handler from your OpenAPI paths.

#### Parameters

- `handlers`: A function that receives a context object and returns an array of route handlers, or an array of pre-defined entries
- `options`: Optional configuration object

#### Returns

A `Handler` function that can be used with any Web API compatible server.

#### Example

```typescript
// Using generator function
const handler = createHandler<paths>((ctx) => [
  ctx.GET("/users", (req, c) => c.jsonResponse(200, { users: [] })),
]);

// Using pre-defined entries array
const getUsers = createContext<paths>().GET("/users", (req, c) => 
  c.jsonResponse(200, { users: [] })
);
const handler = createHandler([getUsers]);
```

#### Options

```typescript
type HandlerOptions = {
  /**
   * The base URL path for the API. All routes will be prefixed with this path.
   * @default "/"
   * @example "/api/v1"
   */
  baseUrl?: `/${string}`;
  
  /**
   * If true, returns undefined for unmatched requests instead of a 404 response.
   * Useful when combining with other handlers or middleware.
   * @default false
   */
  returnUndefined?: boolean;
};
```

### `createContext<Paths>()`

Creates a reusable context for defining individual API endpoints. This allows you to organize your routes across multiple files and compose them flexibly.

#### Returns

A context object with HTTP method functions (`GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `HEAD`, `PATCH`, `TRACE`) for defining individual endpoints.

#### Example: Organizing routes across files

**routes/users.ts**
```typescript
import type { paths } from "../schema.ts";
import { createContext } from "openapi-ts-server";

const ctx = createContext<paths>();

export const listUsers = ctx.GET("/users", (_, c) => 
  c.jsonResponse(200, { users: [] })
);

export const getUser = ctx.GET("/users/{id}", (req, c) => {
  const { id } = c.params.path;
  return c.jsonResponse(200, { id, name: "User" });
});
```

**server.ts**
```typescript
import { createHandler } from "openapi-ts-server";
import { listUsers, getUser } from "./routes/users.ts";

const handler = createHandler([listUsers, getUser]);
```

### Handler Context (`c` object)

The context object passed to each route handler provides type-safe access to request parameters and helper functions.

#### `c.params`

- **`path`**: Path parameters extracted from the URL (e.g., `{id}` in `/users/{id}`)
- **`query`**: URL search parameters with enhanced type safety based on your OpenAPI schema

```typescript
ctx.GET("/users/{id}", (req, c) => {
  const { id } = c.params.path; // Type: string (from path parameter)
  const page = c.params.query.get("page"); // Type: string | null
});
```

#### `c.jsonResponse(status, body, init?)`

Creates a JSON response with proper `Content-Type` headers and full type checking.

```typescript
// The response body is type-checked against your OpenAPI schema
return c.jsonResponse(200, { 
  id: user.id, 
  name: user.name 
}); // ✅ Type-safe

return c.jsonResponse(200, { 
  invalidField: "value" 
}); // ❌ TypeScript error
```

#### `c.delay(ms)`

Utility function to add artificial delays (useful for testing loading states).

```typescript
ctx.GET("/slow-endpoint", async (req, c) => {
  await c.delay(1000); // Wait 1 second
  return c.jsonResponse(200, { message: "Delayed response" });
});
```

## Advanced Usage

### Working with Request Bodies

Request bodies are automatically typed based on your OpenAPI schema:

```typescript
ctx.POST("/users", async (req, c) => {
  // req.json() returns the typed request body
  const userData = await req.json(); 
  // userData is fully typed based on your OpenAPI schema
  
  // Validate and process the data
  const newUser = {
    id: generateId(),
    ...userData,
    createdAt: new Date().toISOString()
  };
  
  return c.jsonResponse(201, newUser);
});
```

### Error Handling

```typescript
ctx.GET("/users/{id}", async (req, c) => {
  const { id } = c.params.path;
  
  try {
    const user = await getUserById(id);
    if (!user) {
      return c.jsonResponse(404, { 
        error: "User not found",
        code: "USER_NOT_FOUND" 
      });
    }
    return c.jsonResponse(200, user);
  } catch (error) {
    return c.jsonResponse(500, { 
      error: "Internal server error",
      code: "INTERNAL_ERROR" 
    });
  }
});
```

### Using Base URLs

```typescript
const handler = createHandler<paths>((ctx) => [
  ctx.GET("/users", (req, c) => c.jsonResponse(200, { users: [] })),
], {
  baseUrl: "/api/v1" // All routes will be prefixed with /api/v1
});

// Now accessible at: /api/v1/users
```

### Middleware Pattern

```typescript
const authHandler = createHandler<paths>((ctx) => [
  ctx.GET("/protected", (req, c) => {
    // Handle protected routes
    return c.jsonResponse(200, { message: "Authenticated" });
  }),
], { returnUndefined: true });

const publicHandler = createHandler<paths>((ctx) => [
  ctx.GET("/public", (req, c) => {
    return c.jsonResponse(200, { message: "Public access" });
  }),
]);

// Combine handlers
const combinedHandler = async (req: Request) => {
  // Try auth handler first
  const authResponse = await authHandler(req);
  if (authResponse) return authResponse;
  
  // Fall back to public handler
  return publicHandler(req);
};
```

## Development

### Setting up the project

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build

# Lint, format, and test code
pnpm check
pnpm fmt
pnpm test
```

## License

MIT
