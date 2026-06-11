import { Test } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";

interface PrismaMock {
  user: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };
  session: { deleteMany: jest.Mock };
  friendship: { deleteMany: jest.Mock };
  $transaction: jest.Mock;
}

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "alice",
    email: "alice@test.com",
    username: "alice",
    avatar: null,
    bio: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
    ...overrides
  };
}

describe("UsersService", () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn()
      },
      session: { deleteMany: jest.fn() },
      friendship: { deleteMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([])
    };
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe("findMe", () => {
    it("devuelve el perfil propio CON email", async () => {
      prisma.user.findFirst.mockResolvedValue(dbUser());
      const result = await service.findMe({ userId: "alice" });
      expect(result.email).toBe("alice@test.com");
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: "alice", deletedAt: null }
      });
    });
    it("404 si no existe o está borrado", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findMe({ userId: "ghost" })).rejects.toThrow("userNotFound");
    });
  });

  describe("findProfile", () => {
    it("devuelve perfil público SIN email", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "bob",
        username: "bob",
        avatar: null,
        bio: null,
        createdAt: new Date("2026-01-01")
      });
      const result = await service.findProfile({ userId: "bob" });
      expect("email" in result).toBe(false);
      expect(result.username).toBe("bob");
      expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
    });
    it("404 si no existe", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findProfile({ userId: "ghost" })).rejects.toThrow("userNotFound");
    });
  });

  describe("updateProfile", () => {
    it("actualiza y devuelve el perfil", async () => {
      // 1ª llamada: el propio usuario existe y no está borrado; 2ª: sin colisión.
      prisma.user.findFirst.mockResolvedValueOnce(dbUser()).mockResolvedValueOnce(null);
      prisma.user.update.mockResolvedValue(dbUser({ bio: "hola" }));
      const result = await service.updateProfile({
        userId: "alice",
        username: "alice",
        avatar: null,
        bio: "hola"
      });
      expect(result.bio).toBe("hola");
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: "alice", deletedAt: null }
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "alice" },
        data: { username: "alice", avatar: null, bio: "hola" }
      });
    });
    it("no-op: si los valores son idénticos, no ejecuta UPDATE (updatedAt intacto)", async () => {
      prisma.user.findFirst.mockResolvedValueOnce(dbUser()); // username alice, avatar/bio null
      const result = await service.updateProfile({
        userId: "alice",
        username: "alice",
        avatar: null,
        bio: null
      });
      expect(result.username).toBe("alice");
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.findFirst).toHaveBeenCalledTimes(1); // tampoco chequea colisión
    });
    it("404 si la cuenta está borrada (no se puede editar el tombstone)", async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null); // borrado o inexistente
      await expect(
        service.updateProfile({ userId: "alice", username: "pepe", avatar: null, bio: null })
      ).rejects.toThrow("userNotFound");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
    it("409 si el username lo tiene OTRO usuario", async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(dbUser()) // yo existo
        .mockResolvedValueOnce(dbUser({ id: "carol" })); // colisión
      await expect(
        service.updateProfile({ userId: "alice", username: "carol", avatar: null, bio: null })
      ).rejects.toThrow("usernameTaken");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteAccount", () => {
    it("soft-delete: borra sesiones/amistades y anonimiza en transacción", async () => {
      const result = await service.deleteAccount({ userId: "alice" });
      expect(result).toEqual({ success: true });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "alice" } });
      expect(prisma.friendship.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ requesterId: "alice" }, { addresseeId: "alice" }] }
      });
      const updateArg = (prisma.user.update.mock.calls[0] as unknown[])[0] as {
        where: { id: string };
        data: {
          email: string;
          username: string;
          avatar: string | null;
          bio: string | null;
          deletedAt: unknown;
        };
      };
      expect(updateArg.where).toEqual({ id: "alice" });
      expect(updateArg.data.email).toBe("deleted_alice@deleted.local");
      expect(updateArg.data.username).toBe("deleted_alice");
      expect(updateArg.data.avatar).toBeNull();
      expect(updateArg.data.bio).toBeNull();
      expect(updateArg.data.deletedAt).toBeInstanceOf(Date);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("searchUsers", () => {
    it("filtra deletedAt:null + username, excluye al que busca y mapea a perfil público", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "bob", username: "bob", avatar: null, bio: null, createdAt: new Date("2026-01-01") }
      ]);
      prisma.user.count.mockResolvedValue(1);
      const result = await service.searchUsers({
        userId: "alice",
        query: "bo",
        page: 1,
        limit: 20
      });
      expect(result.meta.total).toBe(1);
      expect(result.data[0].username).toBe("bob");
      expect("email" in result.data[0]).toBe(false);
      const findManyArg = (prisma.user.findMany.mock.calls[0] as unknown[])[0] as {
        where: {
          deletedAt: Date | null;
          id: { not: string };
          username: { contains: string; mode: string };
        };
      };
      const whereArg = findManyArg.where;
      expect(whereArg.deletedAt).toBeNull();
      expect(whereArg.id).toEqual({ not: "alice" }); // no me encuentro a mí mismo
      expect(whereArg.username).toEqual({ contains: "bo", mode: "insensitive" });
    });
  });
});
