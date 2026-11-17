// @cloudflare/workers-types 里的泛型 json<T>() 盖掉了 lib.dom 的 json(): Promise<any>，
// 使不带类型参数的裸 res.json() 被推断成 Promise<{}>；下面的 Response.json 重声明将其恢复为 Promise<any>。
/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
}

interface Response {
  json(): Promise<any>;
}
