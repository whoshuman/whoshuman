import { PresenceService } from "./presence.service";

describe("PresenceService", () => {
  let presence: PresenceService;

  beforeEach(() => {
    presence = new PresenceService();
  });

  it("add devuelve true solo en el primer socket del usuario", () => {
    expect(presence.add("u1")).toBe(true); // se acaba de conectar
    expect(presence.add("u1")).toBe(false); // segunda pestaña: ya estaba online
  });

  it("remove devuelve true solo al cerrar el último socket", () => {
    presence.add("u1");
    presence.add("u1");
    expect(presence.remove("u1")).toBe(false); // aún le queda una pestaña
    expect(presence.remove("u1")).toBe(true); // ahora sí queda offline
  });

  it("sigue online mientras le quede algún socket abierto", () => {
    presence.add("u1");
    presence.add("u1");
    presence.remove("u1");
    expect(presence.list()).toEqual(["u1"]);
  });

  it("list devuelve solo los usuarios conectados", () => {
    presence.add("u1");
    presence.add("u2");
    presence.remove("u2");
    expect(presence.list()).toEqual(["u1"]);
  });

  it("remove de un usuario desconocido no rompe ni lo deja en negativo", () => {
    expect(presence.remove("fantasma")).toBe(false);
    expect(presence.list()).toEqual([]);
  });
});
