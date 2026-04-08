import { createServer } from "node:http";
import { URL } from "node:url";
import { OAuth2Client } from "google-auth-library";
import type { Credentials } from "google-auth-library";
import { buildOAuthScopes } from "./config.js";
import { TokenStore } from "./token-store.js";
import type { AppEnv } from "../utils/env.js";
import type { Logger } from "../utils/logger.js";

export function createOAuthClient(env: AppEnv): OAuth2Client {
  return new OAuth2Client({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: env.googleRedirectUri,
  });
}

export async function loadAuthorizedClient(env: AppEnv, logger: Logger): Promise<OAuth2Client> {
  const tokenStore = new TokenStore(env.googleTokenPath);
  const storedCredentials = await tokenStore.load();

  if (!storedCredentials) {
    throw new Error(
      `OAuth token file not found at ${tokenStore.absolutePath}. Run "npm run auth" first.`,
    );
  }

  const client = createOAuthClient(env);
  client.setCredentials(storedCredentials);
  client.on("tokens", async (tokens: Credentials) => {
    const merged = { ...client.credentials, ...tokens };
    await tokenStore.save(merged);
    logger.debug("OAuth tokens refreshed and saved to disk.");
  });

  return client;
}

export async function authorizeLocally(env: AppEnv, logger: Logger): Promise<string> {
  const oauthClient = createOAuthClient(env);
  const tokenStore = new TokenStore(env.googleTokenPath);
  const scopes = buildOAuthScopes(env.includeDriveScope);
  const redirect = new URL(env.googleRedirectUri);
  const port = Number.parseInt(redirect.port || "80", 10);
  const expectedPath = redirect.pathname;

  const authUrl = oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    include_granted_scopes: true,
  });

  const codePromise = new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", env.googleRedirectUri);

      if (requestUrl.pathname !== expectedPath) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      const authCode = requestUrl.searchParams.get("code");
      const authError = requestUrl.searchParams.get("error");

      if (authError) {
        response.statusCode = 400;
        response.end(`OAuth authorization failed: ${authError}`);
        server.close();
        reject(new Error(`OAuth authorization failed: ${authError}`));
        return;
      }

      if (!authCode) {
        response.statusCode = 400;
        response.end("Missing OAuth authorization code.");
        return;
      }

      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end("<h1>Authorization completed.</h1><p>You can close this tab.</p>");
      server.close();
      resolve(authCode);
    });

    server.on("error", reject);
    server.listen(port, redirect.hostname);
  });

  process.stderr.write(
    [
      "Open this URL in your browser to authorize the MCP server:",
      authUrl,
      "",
      `Waiting for the OAuth redirect on ${env.googleRedirectUri} ...`,
      "",
    ].join("\n"),
  );

  const code = await codePromise;
  logger.info("Exchanging OAuth authorization code for tokens.");
  const tokenResponse = await oauthClient.getToken(code);

  if (!tokenResponse.tokens.refresh_token) {
    logger.warn(
      "OAuth token response did not include a refresh token. Remove the token file and re-run auth with consent if needed.",
    );
  }

  await tokenStore.save(tokenResponse.tokens);
  logger.info("OAuth tokens saved.", {
    tokenPath: tokenStore.absolutePath,
    includeDriveScope: env.includeDriveScope,
  });

  return authUrl;
}
