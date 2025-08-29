## vite-plugin-vue-typed-router

A Vite plugin that auto-generates a strongly typed route map for Vue Router 4. During development it produces `typed-router.d.ts` from your route records, enhancing type safety and IntelliSense for APIs like `router.push` and `useRoute`.

![example](https://user-images.githubusercontent.com/664177/176442066-c4e7fa31-4f06-4690-a49f-ed0fd880dfca.png)

Difference from `unplugin-vue-router`: `unplugin-vue-router` only supports file-based routing, while this plugin is not limited by routing style.

See the official docs: [typed-routes](https://router.vuejs.org/guide/advanced/typed-routes.html)

### Features

- **Type generation**: Produces a `RouteNamedMap` from your route records and augments `vue-router` types.
- **Param inference**: Infers both raw and normalized param types from path patterns (including repeatable params).
- **Incremental writes**: Skips writing when content is unchanged to avoid unnecessary triggers.

### Installation

```bash
pnpm add -D vite-plugin-vue-typed-router
# or
npm i -D vite-plugin-vue-typed-router
# or
yarn add -D vite-plugin-vue-typed-router
```

> Peer dependency: `vue-router@^4.1.0`

### Getting Started

1. Enable the plugin in `vite.config.ts`

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import typedRouter from "vite-plugin-vue-typed-router";

export default defineConfig({
  plugins: [
    vue(),
    typedRouter({
      // Optional: specify the output directory. Defaults to project root
      // For example, output to src/types → generates src/types/typed-router.d.ts
      dir: "src/types",
    }),
  ],
});
```

2. Send your routes to the dev server at app startup (development only)

The plugin listens to a Vite HMR WebSocket event and generates the type file. You need to send the event in development:

```ts
// main.ts (example)
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

export const routes: RouteRecordRaw[] = [
  { name: "home", path: "/" },
  { name: "user", path: "/users/:id" },
  { name: "docs", path: "/docs/:slug+" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Dev-only: send the routes via HMR to the plugin
if (import.meta.hot) {
  import.meta.hot.send("typed-router:routes", router.getRoutes());
}

export default router;
```

> Note: The event name is `typed-router:routes`. The payload should be a `RouteRecordRaw[]` (must include `name` and `path`, and may include `children`).

3. Ensure TypeScript sees the generated declaration file

Include the generated file path in `tsconfig.json` (assuming you output to `src/types`):

```json
{
  "compilerOptions": { "strict": true },
  "include": ["src", "src/types/typed-router.d.ts"]
}
```

After these steps, start the dev server and you should see a log like:

```
🌟[typed-router] Wrote types for 20 routes to /your-project/src/types/typed-router.d.ts
```

### Usage Examples

Once generated, you get strong typing on route names and params:

```ts
// In a component or anywhere
import { useRouter } from "vue-router";

const router = useRouter();

// OK: params are correctly inferred
router.push({ name: "user", params: { id: 123 } });

// Type error: required id is missing
// router.push({ name: 'user', params: {} })

// Type error: extra or mismatched params are caught
// router.push({ name: 'docs', params: { slug: 1 } }) // slug should be string[] (normalized) or Array<string | number> (raw)
```

### What Gets Generated

The plugin generates a declaration file like the following (simplified):

```ts
// typed-router.d.ts (excerpt)
import type { RouteRecordInfo } from "vue-router";

export interface RouteNamedMap {
  docs: RouteRecordInfo<
    "docs",
    "/docs/:slug+",
    { slug: Array<string | number> },
    { slug: string[] },
    never
  >;
  home: RouteRecordInfo<
    "home",
    "/",
    Record<never, never>,
    Record<never, never>,
    never
  >;
  user: RouteRecordInfo<
    "user",
    "/users/:id",
    { id: string | number },
    { id: string },
    never
  >;
}

declare module "vue-router" {
  interface TypesConfig {
    RouteNamedMap: RouteNamedMap;
  }
}
```

- **Raw params type (3rd generic)**: values directly from the URL. Numbers may still be strings. Repeatable params are `Array<string | number>`.
- **Normalized params type (4th generic)**: values after Vue Router normalization. Numbers are serialized to strings. Repeatable params are `string[]`.
- **Children union (5th generic)**: union of `name` from `children` routes, or `never` if none.

Supported param syntax follows Vue Router:

- **Required params**: `/users/:id`
- **Repeatable params**: `/docs/:slug+` or `*` (see official docs)

### Options

- **dir**: Directory where the file is emitted.
  - Type: `string`
  - Default: `''` (project root)
  - Example: `dir: 'src/types'` emits `src/types/typed-router.d.ts`

### FAQ

- **`typed-router.d.ts` not generated?**

  - Ensure you call `import.meta.hot.send('typed-router:routes', routes)` in development.
  - Each array item must have at least `name: string` and `path: string`; `children` is optional.
  - Check terminal logs starting with `🌟[typed-router]`.

- **Generated in production builds?**

  - The plugin relies on a dev-time HMR event. Typically you generate locally and commit the file.

- **Should I commit the generated file?**

  - Recommended (so CI/build environments don't need to regenerate).

- **TypeScript cannot find types?**
  - Verify the `include` in `tsconfig.json` contains the generated file path.

### License

ISC
