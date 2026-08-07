import { Injectable } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import type { OAuthProvider } from "@whoshuman/shared-types";
import { envs } from "../config";

export interface OAuthIdentity {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  avatar: string | null;
  suggestedDesignation: string;
}

interface OAuthProviderConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

interface TokenResponse {
  access_token?: string;
}

interface GoogleProfile {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

interface FortyTwoProfile {
  id?: number;
  email?: string;
  login?: string;
  image?: { link?: string };
  image_url?: string;
}

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const FORTYTWO_AUTHORIZE_URL = "https://api.intra.42.fr/oauth/authorize";
const FORTYTWO_TOKEN_URL = "https://api.intra.42.fr/oauth/token";
const FORTYTWO_USERINFO_URL = "https://api.intra.42.fr/v2/me";

@Injectable()
export class OAuthProviderService {
  authorizationUrl(provider: OAuthProvider, state: string): string {
    const config = this.config(provider);
    const url = new URL(provider === "google" ? GOOGLE_AUTHORIZE_URL : FORTYTWO_AUTHORIZE_URL);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("scope", provider === "google" ? "openid email profile" : "public");
    if (provider === "google") url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  async exchangeCode(provider: OAuthProvider, code: string): Promise<OAuthIdentity> {
    const config = this.config(provider);
    const tokenUrl = provider === "google" ? GOOGLE_TOKEN_URL : FORTYTWO_TOKEN_URL;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code
    });

    const token = await this.fetchJson<TokenResponse>(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!token.access_token) this.fail("oauthProviderUnavailable", 502);

    return provider === "google"
      ? this.googleIdentity(token.access_token)
      : this.fortyTwoIdentity(token.access_token);
  }

  private async googleIdentity(accessToken: string): Promise<OAuthIdentity> {
    const profile = await this.fetchJson<GoogleProfile>(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!profile.sub || !profile.email || profile.email_verified !== true) {
      this.fail("oauthIdentityInvalid", 401);
    }

    return {
      provider: "google",
      providerAccountId: profile.sub,
      email: profile.email.toLowerCase(),
      avatar: profile.picture ?? null,
      suggestedDesignation: this.designation(profile.name ?? profile.email.split("@")[0])
    };
  }

  private async fortyTwoIdentity(accessToken: string): Promise<OAuthIdentity> {
    const profile = await this.fetchJson<FortyTwoProfile>(FORTYTWO_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (typeof profile.id !== "number" || !profile.email || !profile.login) {
      this.fail("oauthIdentityInvalid", 401);
    }

    return {
      provider: "42",
      providerAccountId: String(profile.id),
      email: profile.email.toLowerCase(),
      avatar: profile.image?.link ?? profile.image_url ?? null,
      suggestedDesignation: this.designation(profile.login)
    };
  }

  private config(provider: OAuthProvider): Required<OAuthProviderConfig> {
    const config =
      provider === "google"
        ? {
            clientId: envs.googleClientId,
            clientSecret: envs.googleClientSecret,
            redirectUri: envs.googleRedirectUri
          }
        : {
            clientId: envs.fortyTwoClientId,
            clientSecret: envs.fortyTwoClientSecret,
            redirectUri: envs.fortyTwoRedirectUri
          };

    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
      this.fail("oauthProviderNotConfigured", 503);
    }
    return config as Required<OAuthProviderConfig>;
  }

  private designation(value: string): string {
    const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
    return cleaned.length >= 3 ? cleaned : "unidad";
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { Accept: "application/json", ...init.headers },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) this.fail("oauthProviderUnavailable", 502);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.fail("oauthProviderUnavailable", 502);
    }
  }

  private fail(message: string, statusCode: number): never {
    throw new RpcException({ statusCode, message });
  }
}
