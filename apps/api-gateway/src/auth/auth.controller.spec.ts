import { AuthSubjects } from "@whoshuman/shared-events";
import type { MessagingService } from "../common";
import { AuthController } from "./auth.controller";

describe("AuthController OAuth callback", () => {
  it("accepts the URL-encoded state cookie written by Express", async () => {
    const request = jest.fn().mockResolvedValue({
      ticket: "oauth-ticket",
      requiresDesignation: true,
      suggestedDesignation: "unit42"
    });
    const controller = new AuthController({ request } as unknown as MessagingService);
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn()
    };

    await controller.oauthCallback(
      "google",
      "authorization-code",
      "random-state",
      undefined,
      { headers: { cookie: "oauth_state=google%3Arandom-state" } },
      response
    );

    expect(request).toHaveBeenCalledWith(
      AuthSubjects.oauthCallback,
      { provider: "google", code: "authorization-code" },
      20_000
    );
    expect(response.redirect).toHaveBeenCalledWith(
      expect.stringContaining("#ticket=oauth-ticket&requiresDesignation=true")
    );
  });
});
