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
  score: { findMany: jest.Mock; groupBy: jest.Mock };
  $transaction: jest.Mock;
}

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "alice",
    email: "alice@test.com",
    username: "alice",
    avatar: null,
    bio: null,
    language: "en",
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
      score: { findMany: jest.fn(), groupBy: jest.fn() },
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

  describe("combatStats", () => {
    it("agrega partidas, victorias, puntos y las cinco más recientes", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "alice" });
      prisma.user.findMany.mockResolvedValue([
        { id: "alice", username: "alice", avatar: null },
        { id: "bob", username: "bob", avatar: null }
      ]);
      prisma.score.groupBy.mockResolvedValue([
        { userId: "alice", _sum: { points: 225 }, _count: { _all: 2 } },
        { userId: "bob", _sum: { points: 125 }, _count: { _all: 2 } }
      ]);
      prisma.score.findMany.mockResolvedValue([
        {
          gameId: "g2",
          points: 75,
          createdAt: new Date("2026-02-02"),
          game: {
            updatedAt: new Date("2026-02-02"),
            scores: [
              { userId: "bob", points: 100, user: { username: "bob" } },
              { userId: "alice", points: 75, user: { username: "alice" } },
              { userId: "carol", points: 25, user: { username: "carol" } }
            ]
          }
        },
        {
          gameId: "g1",
          points: 150,
          createdAt: new Date("2026-02-01"),
          game: {
            updatedAt: new Date("2026-02-01"),
            scores: [
              { userId: "alice", points: 150, user: { username: "alice" } },
              { userId: "bob", points: 100, user: { username: "bob" } }
            ]
          }
        }
      ]);

      const result = await service.combatStats({ userId: "alice" });

      expect(result).toMatchObject({
        totalGames: 2,
        wins: 1,
        losses: 1,
        totalPoints: 225,
        bestScore: 150,
        averagePoints: 113,
        globalRank: 1,
        progression: {
          level: 2,
          experiencePoints: 325,
          currentLevelExperience: 125,
          experienceForNextLevel: 270,
          progressPercent: 46
        }
      });
      expect(result.recentMatches).toEqual([
        {
          gameId: "g2",
          points: 75,
          placement: 2,
          playerCount: 3,
          playedAt: "2026-02-02T00:00:00.000Z",
          opponents: ["bob", "carol"]
        },
        {
          gameId: "g1",
          points: 150,
          placement: 1,
          playerCount: 2,
          playedAt: "2026-02-01T00:00:00.000Z",
          opponents: ["bob"]
        }
      ]);
      expect(result.achievements).toEqual([
        { id: "firstMatch", unlocked: true, current: 2, target: 1 },
        { id: "firstWin", unlocked: true, current: 1, target: 1 },
        { id: "veteran", unlocked: false, current: 2, target: 10 },
        { id: "thousandPoints", unlocked: false, current: 225, target: 1000 }
      ]);
      expect(result.leaderboard).toEqual([
        {
          rank: 1,
          userId: "alice",
          username: "alice",
          avatar: null,
          totalPoints: 225,
          totalGames: 2
        },
        {
          rank: 2,
          userId: "bob",
          username: "bob",
          avatar: null,
          totalPoints: 125,
          totalGames: 2
        }
      ]);
      expect(prisma.score.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "alice", game: { status: "ENDED" } },
          orderBy: { createdAt: "desc" }
        })
      );
    });

    it("devuelve ceros cuando todavía no hay partidas", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "alice" });
      prisma.score.findMany.mockResolvedValue([]);
      prisma.score.groupBy.mockResolvedValue([]);

      await expect(service.combatStats({ userId: "alice" })).resolves.toEqual({
        totalGames: 0,
        wins: 0,
        losses: 0,
        totalPoints: 0,
        bestScore: 0,
        averagePoints: 0,
        globalRank: null,
        progression: {
          level: 1,
          experiencePoints: 0,
          currentLevelExperience: 0,
          experienceForNextLevel: 200,
          progressPercent: 0
        },
        achievements: [
          { id: "firstMatch", unlocked: false, current: 0, target: 1 },
          { id: "firstWin", unlocked: false, current: 0, target: 1 },
          { id: "veteran", unlocked: false, current: 0, target: 10 },
          { id: "thousandPoints", unlocked: false, current: 0, target: 1000 }
        ],
        leaderboard: [],
        recentMatches: []
      });
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
        bio: "hola",
        language: "en"
      });
      expect(result.bio).toBe("hola");
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: "alice", deletedAt: null }
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "alice" },
        data: { username: "alice", avatar: null, bio: "hola", language: "en" }
      });
    });
    it("no-op: si los valores son idénticos, no ejecuta UPDATE (updatedAt intacto)", async () => {
      prisma.user.findFirst.mockResolvedValueOnce(dbUser()); // username alice, avatar/bio null
      const result = await service.updateProfile({
        userId: "alice",
        username: "alice",
        avatar: null,
        bio: null,
        language: "en"
      });
      expect(result.username).toBe("alice");
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.findFirst).toHaveBeenCalledTimes(1); // tampoco chequea colisión
    });
    it("actualiza el language si el nuevo valor es soportado", async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(dbUser({ language: "en" }))
        .mockResolvedValueOnce(null);
      prisma.user.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(dbUser({ ...data }))
      );
      const result = await service.updateProfile({
        userId: "alice",
        username: "alice",
        avatar: null,
        bio: null,
        language: "es"
      });
      expect(result.language).toBe("es");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "alice" },
        data: { username: "alice", avatar: null, bio: null, language: "es" }
      });
    });
    it("conserva el language actual si el nuevo valor no es soportado", async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(dbUser({ language: "en" }))
        .mockResolvedValueOnce(null);
      prisma.user.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(dbUser({ ...data }))
      );
      const result = await service.updateProfile({
        userId: "alice",
        username: "alice",
        avatar: null,
        bio: "cambio", // fuerza que no sea no-op
        language: "xx"
      });
      expect(result.language).toBe("en");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "alice" },
        data: { username: "alice", avatar: null, bio: "cambio", language: "en" }
      });
    });
    it("404 si la cuenta está borrada (no se puede editar el tombstone)", async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null); // borrado o inexistente
      await expect(
        service.updateProfile({
          userId: "alice",
          username: "pepe",
          avatar: null,
          bio: null,
          language: "en"
        })
      ).rejects.toThrow("userNotFound");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
    it("409 si el username lo tiene OTRO usuario", async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(dbUser()) // yo existo
        .mockResolvedValueOnce(dbUser({ id: "carol" })); // colisión
      await expect(
        service.updateProfile({
          userId: "alice",
          username: "carol",
          avatar: null,
          bio: null,
          language: "en"
        })
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
