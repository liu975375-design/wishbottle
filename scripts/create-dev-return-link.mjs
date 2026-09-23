#!/usr/bin/env node

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEV_DEFAULT_BASE_URL = "http://localhost:3001";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function loadLocalEnv() {
  const path = ".env.local";

  if (!fs.existsSync(path)) {
    throw new Error(".env.local is required for the local test token script.");
  }

  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match) {
      continue;
    }

    process.env[match[1]] ??= match[2]
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
  }
}

function getArgument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));

  return value?.slice(prefix.length);
}

function usage() {
  console.log(
    "Usage: node scripts/create-dev-return-link.mjs <wish_id|wish_code> [--ttl-minutes=30] [--base-url=http://localhost:3001]",
  );
  console.log(
    "Cleanup: node scripts/create-dev-return-link.mjs --delete-token=<token_id>",
  );
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("This development helper cannot run in production.");
  }

  loadLocalEnv();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const returnSessionSecret = process.env.RETURN_SESSION_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !returnSessionSecret) {
    throw new Error(
      "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and RETURN_SESSION_SECRET are required.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const deleteTokenId = getArgument("delete-token");

  if (deleteTokenId) {
    if (!UUID_PATTERN.test(deleteTokenId)) {
      throw new Error("--delete-token must be a token UUID.");
    }

    const { data, error } = await supabase
      .from("wish_return_tokens")
      .delete()
      .eq("id", deleteTokenId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    console.log(`Deleted return token record: ${data?.id ?? "not found"}`);
    return;
  }

  const identifier = process.argv[2];

  if (!identifier || identifier.startsWith("--")) {
    usage();
    process.exitCode = 1;
    return;
  }

  const wishQuery = supabase
    .from("wishes")
    .select("id, wish_code, name")
    .limit(1);
  const { data: wish, error: wishError } = UUID_PATTERN.test(identifier)
    ? await wishQuery.eq("id", identifier).maybeSingle()
    : await wishQuery.eq("wish_code", identifier.trim().toUpperCase()).maybeSingle();

  if (wishError) {
    throw wishError;
  }

  if (!wish) {
    throw new Error("Wish not found.");
  }

  const { generateReturnToken, hashReturnToken } = await import(
    "../lib/return-session.ts"
  );
  const ttlMinutes = Number(getArgument("ttl-minutes") ?? "30");
  const baseUrl = (
    getArgument("base-url") ||
    process.env.APP_BASE_URL ||
    DEV_DEFAULT_BASE_URL
  ).replace(/\/+$/, "");

  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
    throw new Error("--ttl-minutes must be a positive number.");
  }

  const token = generateReturnToken();
  const tokenHash = hashReturnToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("wish_return_tokens")
    .insert({
      wish_id: wish.id,
      reminder_id: null,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();

  if (tokenError) {
    throw tokenError;
  }

  console.log(`Wish Code: ${wish.wish_code}`);
  console.log(`Name: ${wish.name ?? "Unnamed"}`);
  console.log(`Token expires: ${tokenRecord.expires_at}`);
  console.log(`Return URL: ${baseUrl}/return/${token}`);
  console.log(
    `Cleanup: node scripts/create-dev-return-link.mjs --delete-token=${tokenRecord.id}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
