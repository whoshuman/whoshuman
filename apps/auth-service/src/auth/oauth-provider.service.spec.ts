jest.mock("../config", () => ({
  envs: {
    googleClientId: "google-client",
    googleClientSecret: "google-secret",
    googleRedirectUri: "https://localhost/api/auth/oauth/google/callback",
    fortyTwoClientId: "42-client",
    fortyTwoClientSecret: "42-secret",
    fortyTwoRedirectUri: "https://localhost/api/auth/oauth/42/callback"
  }
}));

import { OAuthProviderService } from "./oauth-provider.service";

const fetchMock = jest.fn();
global.fetch = fetchMock;

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

describe("OAuthProviderService", () => {
  const service = new OAuthProviderService();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("construye la autorización Google con state y Authorization Code flow", () => {
    const url = new URL(service.authorizationUrl("google", "secure-state"));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("secure-state");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });

  it("intercambia el código Google y exige un email verificado", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "google-access" }))
      .mockResolvedValueOnce(
        jsonResponse({
          sub: "google-user",
          email: "Unit@Example.com",
          email_verified: true,
          name: "Unit Pilot",
          picture: "https://example.com/avatar.png"
        })
      );

    const identity = await service.exchangeCode("google", "authorization-code");

    expect(identity).toEqual({
      provider: "google",
      providerAccountId: "google-user",
      email: "unit@example.com",
      avatar: "https://example.com/avatar.png",
      suggestedDesignation: "UnitPilot"
    });
  });

  it("intercambia el código 42 y usa el login como designación sugerida", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "42-access" }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 4242,
          email: "CADET@STUDENT.42.FR",
          login: "cadet42",
          image: { link: "https://cdn.intra.42.fr/cadet.png" }
        })
      );

    const identity = await service.exchangeCode("42", "authorization-code");

    expect(identity).toEqual({
      provider: "42",
      providerAccountId: "4242",
      email: "cadet@student.42.fr",
      avatar: "https://cdn.intra.42.fr/cadet.png",
      suggestedDesignation: "cadet42"
    });
  });
});
