import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import type { RouteRecordRaw } from "vue-router";

interface TypedRouterPluginOptions {
  /**
   * @description directory of the typed-router.d.ts file
   * @default ./typed-router.d.ts
   */
  dir?: string;
}

/**
 * @description generate typed-router.d.ts file
 * @returns vite plugin
 */
export default function typedRouterPlugin({
  dir = "",
}: TypedRouterPluginOptions = {}): Plugin {
  return {
    name: "vite-plugin-vue-typed-router",
    enforce: "post",
    configureServer(server) {
      server.ws.on("my:from-client", (routes: RouteRecordRaw[]) => {
        try {
          // -- code template, every line is a item in the array --
          const header = [
            "// import the `RouteRecordInfo` type from vue-router to type your routes",
            "import type { RouteRecordInfo } from 'vue-router'",
            "",
            "// Define an interface of routes",
            "export interface RouteNamedMap {",
          ];
          const body: string[] = [];
          const footer = [
            "}",
            "",
            "// Last, you will need to augment the Vue Router types with this map of routes",
            "declare module 'vue-router' {",
            "  interface TypesConfig {",
            "    RouteNamedMap: RouteNamedMap",
            "  }",
            "}",
            "",
          ];
          // -- generate body --
          routes
            // filter out bad data
            .filter((r) => {
              const isOk =
                typeof r?.name === "string" && typeof r?.path === "string";
              if (!isOk) {
                console.log(
                  `🌟[typed-router] skip generate this route(name: ${String(
                    r?.name
                  )} path: ${String(r?.path)}), because is not string`
                );
              }
              return isOk;
            })
            // sort by name
            .sort((a, b) => String(a.name).localeCompare(String(b.name)))
            // generate routes
            .forEach((r) => {
              const name = String(r.name);
              const path = String(r.path);
              const { rawType, normType } = parseParamsFromPath(path);
              const childrenUnion = getChildrenUnion(r);
              // one route
              body.push(
                `  '${escapeSingleQuotes(name)}': RouteRecordInfo<\n` +
                  `    '${escapeSingleQuotes(name)}',\n` +
                  `    '${escapeSingleQuotes(path)}',\n` +
                  `    ${rawType},\n` +
                  `    ${normType},\n` +
                  `    ${childrenUnion}\n` +
                  "  >"
              );
            });
          // -- generate code --
          const content = [...header, ...body, ...footer].join("\n");
          const outFile = resolve(
            server?.config?.root ?? process.cwd(),
            dir,
            "typed-router.d.ts"
          );
          // -- diff --
          if (existsSync(outFile)) {
            try {
              const prev = readFileSync(outFile, "utf-8");
              if (prev === content) {
                return;
              }
            } catch {}
          }
          // -- write file --
          writeFileSync(outFile, content, "utf-8");
          // best-effort: avoid watching generated file
          try {
            server.watcher?.unwatch?.(outFile);
          } catch {}
          console.info(
            `🌟[typed-router] Wrote types for ${body.length} routes to`,
            outFile
          );
          console.info(
            `🌟[typed-router] mark sure include this file in tsconfig.json, example: {"include": [..., typed-router.d.ts"]}`
          );
        } catch (err) {
          console.error("🌟[typed-router] Failed to generate types:", err);
        }
      });
    },
  };
}

/** escape single quotes */
function escapeSingleQuotes(str: string) {
  return String(str).replace(/'/g, "\\'");
}

/** parse params from path */
function parseParamsFromPath(path: string) {
  const params = [];
  const arrayParams = []; // https://router.vuejs.org/guide/essentials/route-matching-syntax.html#Repeatable-params

  const regex = /:(\w+)(\([^)]*\))?([+*])?/g;
  for (;;) {
    const next = regex.exec(path);
    if (next === null) break;
    const name = next[1];
    const hasRepeat = next[3] === "+" || next[3] === "*";
    if (hasRepeat) {
      arrayParams.push(name);
    } else {
      params.push(name);
    }
  }

  const rawEntries: string[] = []; // raw type, can be string or number
  const normEntries: string[] = []; // normalized type, can only be string
  params.forEach((p) => {
    rawEntries.push(`  ${p}: string | number`);
    normEntries.push(`  ${p}: string`);
  });
  arrayParams.forEach((p) => {
    rawEntries.push(`  ${p}: Array<string | number>`);
    normEntries.push(`  ${p}: string[]`);
  });

  const rawType = rawEntries.length
    ? `{
${rawEntries.join("\n")}
}`
    : "Record<never, never>";
  const normType = normEntries.length
    ? `{
${normEntries.join("\n")}
}`
    : "Record<never, never>";

  return { rawType, normType };
}

/** get children union */
function getChildrenUnion(route: RouteRecordRaw) {
  const children = Array.isArray(route?.children) ? route.children : [];
  const childNames = children
    .map((c) => (typeof c?.name === "string" ? c.name : null))
    .filter(Boolean);
  if (!childNames.length) return "never";
  return childNames.map((n) => `'${escapeSingleQuotes(n!)}'`).join(" | ");
}
