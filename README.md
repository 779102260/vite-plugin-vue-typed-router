## vite-plugin-vue-typed-router

为 Vue Router 4 自动生成「强类型路由映射」的 Vite 插件。开发时根据你的路由表生成 `typed-router.d.ts`，增强 `router.push`、`useRoute` 等 API 的类型提示与校验。

与`unplugin-vue-router`的区别：`unplugin-vue-router`仅支持文件路由，而此插件不受限制。

详情参见官方资料：[typed-routes](https://router.vuejs.org/zh/guide/advanced/typed-routes.html)

### 特性

- **自动生成类型**：从你的路由表生成 `RouteNamedMap` 并增强 `vue-router` 的类型。
- **参数推断**：基于路径中的参数语法推断 params 的原始与规范化类型（含可重复参数）。
- **增量写入**：内容未变化时不重复写入文件，避免多余触发。

### 安装

```bash
pnpm add -D vite-plugin-vue-typed-router
# 或
npm i -D vite-plugin-vue-typed-router
# 或
yarn add -D vite-plugin-vue-typed-router
```

> Peer 依赖：`vue-router@^4.1.0`

### 快速开始

1. 在 `vite.config.ts` 中启用插件

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import typedRouter from "vite-plugin-vue-typed-router";

export default defineConfig({
  plugins: [
    vue(),
    typedRouter({
      // 可选：将文件输出到指定目录。默认写到项目根目录
      // 例如输出到 src/types：将会生成 src/types/typed-router.d.ts
      // dir: "src/types",
    }),
  ],
});
```

2. 在应用启动时（仅开发环境）发送路由表到开发服务器

插件通过 Vite 的 HMR WebSocket 事件接收你的路由表，然后生成类型文件。你需要在开发环境发送一次事件：

```ts
// main.ts（示例）
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

// 仅开发环境触发：把路由表通过 HMR 事件发给插件
if (import.meta.hot) {
  import.meta.hot.send("typed-router:routes", router.getRoutes());
}

export default router;
```

> 说明：事件名固定为 `typed-router:routes`，负载需是 `RouteRecordRaw[]`（至少包含 `name` 与 `path`，可带 `children`）。

3. 确保 TypeScript 能看到生成的声明文件

在 `tsconfig.json` 中包含生成的文件路径（以下示例假设你将其输出到 `src/types`）：

```json
{
  "compilerOptions": { "strict": true },
  "include": ["src", "src/types/typed-router.d.ts"]
}
```

完成以上步骤后，启动开发服务器，控制台会看到类似日志：

```
🌟[typed-router] Wrote types for 20 routes to /your-project/src/types/typed-router.d.ts
```

### 使用示例

当文件生成后，你将获得带有路由名与 params 的强类型提示：

```ts
// 在组件或任意地方
import { useRouter } from "vue-router";

const router = useRouter();

// OK：参数类型被正确推断
router.push({ name: "user", params: { id: 123 } });

// 类型错误：缺少必需的 id
// router.push({ name: 'user', params: {} })

// 类型错误：多余的参数或类型不匹配会被捕获
// router.push({ name: 'docs', params: { slug: 1 } }) // slug 应为 string[]（规范化）或 Array<string | number>（原始）
```

### 生成内容说明

插件会生成如下结构的声明文件（简化示例）：

```ts
// typed-router.d.ts（节选）
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

- **原始参数类型（第三个泛型）**：来自 URL 的原始值，数字可能还是字符串；可重复参数为 `Array<string | number>`。
- **规范化参数类型（第四个泛型）**：Vue Router 规范化后的值，数字被序列化为字符串；可重复参数为 `string[]`。
- **子路由联合（第五个泛型）**：`children` 路由的 `name` 联合类型，如无则为 `never`。

支持的参数语法同 Vue Router：

- **必需参数**：`/users/:id`
- **可重复参数**：`/docs/:slug+` 或 `*`（参考官方文档）

### 配置项

- **dir**：生成文件所在目录。
  - 类型：`string`
  - 默认：`''`（项目根目录）
  - 示例：`dir: 'src/types'` 会输出到 `src/types/typed-router.d.ts`

### 常见问题（FAQ）

- **没有生成 `typed-router.d.ts`？**

  - 确认已在开发模式下调用了 `import.meta.hot.send('typed-router:routes', routes)`。
  - 发送的数组元素需要至少包含 `name: string` 与 `path: string`，可选 `children`。
  - 查看终端日志是否出现以 `🌟[typed-router]` 开头的信息。

- **生产构建会生成吗？**

  - 本插件依赖开发时的 HMR 事件，一般在本地开发时生成并提交到仓库即可。

- **需要把生成文件加入版本控制吗？**

  - 推荐加入（便于 CI/构建环境无需再次生成）。

- **TS 找不到类型？**
  - 检查 `tsconfig.json` 的 `include` 是否包含生成文件路径。

### 许可证

ISC
