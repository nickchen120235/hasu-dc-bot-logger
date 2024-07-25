import { load } from "https://deno.land/std@0.213.0/dotenv/mod.ts";
import { monotonicFactory } from "https://deno.land/x/ulid/mod.ts";

await load({ export: true });
const kv = await Deno.openKv(Deno.env.get("KV"));
const SHARED_SECRET = Deno.env.get("SHARED_SECRET") ?? "DEFAULT_SECRET";
const ulid = monotonicFactory();

interface LogData {
  channel: string;
  user: string;
  content: string;
}

function isLogData(data: object): data is LogData {
  return (
    "channel" in data &&
    "user" in data &&
    "content" in data &&
    typeof data.channel === "string" &&
    typeof data.user === "string" &&
    typeof data.content === "string"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Preshared-Key",
      },
      status: 204,
    });
  }
  if (!req.headers.has("X-Preshared-Key") || req.headers.get("X-Preshared-Key") !== SHARED_SECRET)
    return new Response("Unauthorized", { status: 401 });
  switch (req.method) {
    case "GET": {
      const entries = kv.list<LogData>({ prefix: ["logs"] });
      const data = []
      for await (const { key, value } of entries) data.push({ key, value });
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        status: 200,
      });
    }
    case "POST": {
      const data = await req.json();
      if (!isLogData(data)) return new Response("Invalid data", { status: 400 });
      await kv.set(["logs", ulid()], data, { expireIn: 1000 * 86400 * 30 });
      return new Response(null, { status: 201 });
    }
    default:
      return new Response("Invalid method", { status: 405 });
  }
});
