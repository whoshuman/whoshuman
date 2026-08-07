import { AVATAR_MAX_LENGTH } from "@whoshuman/shared-validation";
import { validate } from "class-validator";
import { UpdateProfileDto } from "./update-profile.dto";

function dtoWithAvatar(avatar: string) {
  return Object.assign(new UpdateProfileDto(), {
    username: "alice",
    language: "en",
    avatar
  });
}

describe("UpdateProfileDto avatar", () => {
  it.each(["data:image/webp;base64,AA==", "https://example.com/avatar.png"])(
    "acepta %s",
    async (avatar) => {
      await expect(validate(dtoWithAvatar(avatar))).resolves.toHaveLength(0);
    }
  );

  it.each([
    ["HTTP", "http://example.com/avatar.png"],
    ["SVG", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="],
    ["un avatar demasiado grande", `data:image/png;base64,${"A".repeat(AVATAR_MAX_LENGTH)}`]
  ])("rechaza %s", async (_case, avatar) => {
    expect(await validate(dtoWithAvatar(avatar))).not.toHaveLength(0);
  });
});
