// Tests unitarios de AuthService.
//
// Estrategia: mockeamos PrismaService (la BD) con jest.fn() para no necesitar una
// base de datos real, pero usamos el JwtService y bcrypt REALES para que los tokens
// y los hashes se comporten exactamente como en producción.
//
// El módulo de config se mockea para inyectar secretos de prueba sin depender del .env.

// Mock del config: evita cargar dotenv + validación joi y nos da secretos deterministas.
jest.mock("../config", () => ({
  envs: {
    jwtSecret: "test_access_secret",
    jwtExpiresIn: "15m",
    jwtRefreshSecret: "test_refresh_secret",
    jwtRefreshExpiresIn: "7d"
  }
}));

import { JwtService } from "@nestjs/jwt";
import { RpcException } from "@nestjs/microservices";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

// Tipo del mock de Prisma: solo los métodos que AuthService usa realmente.
interface PrismaMock {
  user: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  session: {
    create: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
  };
}

// Lee, tipado, el primer argumento de la primera llamada a un mock de Prisma create.
// Evita el acceso a `any` que produce mock.calls sin tipar.
function firstCreateArg(mock: jest.Mock): { data: { passwordHash: string } } {
  const calls = mock.mock.calls as Array<[{ data: { passwordHash: string } }]>;
  return calls[0][0];
}

function firstSessionCreateArg(mock: jest.Mock): { data: { expiresAt: Date } } {
  const calls = mock.mock.calls as Array<[{ data: { expiresAt: Date } }]>;
  return calls[0][0];
}

// Devuelve un usuario de BD de ejemplo (incluye passwordHash, como vendría de Prisma).
function buildDbUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-123",
    email: "alice@test.com",
    username: "alice",
    passwordHash: "", // se rellena en cada test con un hash real
    avatar: null,
    bio: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides
  };
}

describe("AuthService", () => {
  let service: AuthService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn()
      },
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn()
      }
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AuthService, JwtService, { provide: PrismaService, useValue: prisma }]
    }).compile();

    service = moduleRef.get(AuthService);
  });

  // ─── REGISTER ──────────────────────────────────────────────────────────────────

  describe("register", () => {
    const dto = { email: "alice@test.com", username: "alice", password: "password123" };

    it("crea el usuario, hashea la contraseña y devuelve tokens", async () => {
      prisma.user.findFirst.mockResolvedValue(null); // no existe colisión
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildDbUser(data))
      );
      prisma.session.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result.user.email).toBe(dto.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      // La contraseña NUNCA se guarda en texto plano: el hash debe ser distinto.
      const createArg = firstCreateArg(prisma.user.create);
      expect(createArg.data.passwordHash).not.toBe(dto.password);
      expect(createArg.data.passwordHash.length).toBeGreaterThan(20);
    });

    it("guarda la sesión con la duración configurada en JWT_REFRESH_EXPIRES_IN", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildDbUser(data))
      );
      prisma.session.create.mockResolvedValue({});

      const before = Date.now();
      await service.register(dto);
      const after = Date.now();

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const sessionCreateArg = firstSessionCreateArg(prisma.session.create);
      const expiresAtMs = sessionCreateArg.data.expiresAt.getTime();

      expect(expiresAtMs).toBeGreaterThanOrEqual(before + sevenDaysMs);
      expect(expiresAtMs).toBeLessThanOrEqual(after + sevenDaysMs);
    });

    it("NO filtra el passwordHash en la respuesta", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildDbUser(data))
      );
      prisma.session.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect("password" in result.user).toBe(false);
      expect("passwordHash" in result.user).toBe(false);
    });

    it("rechaza si el email ya está en uso (409)", async () => {
      prisma.user.findFirst.mockResolvedValue(buildDbUser({ email: dto.email }));

      await expect(service.register(dto)).rejects.toBeInstanceOf(RpcException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("rechaza si el username ya está cogido (409)", async () => {
      // Mismo username pero email distinto → el código detecta colisión de username.
      prisma.user.findFirst.mockResolvedValue(buildDbUser({ email: "otro@test.com" }));

      await expect(service.register(dto)).rejects.toBeInstanceOf(RpcException);
    });
  });

  // ─── LOGIN ─────────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("inicia sesión con credenciales correctas", async () => {
      // Registramos primero para obtener un hash real de "password123".
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildDbUser(data))
      );
      prisma.session.create.mockResolvedValue({});
      const reg = await service.register({
        email: "alice@test.com",
        username: "alice",
        password: "password123"
      });
      const hash = firstCreateArg(prisma.user.create).data.passwordHash;

      prisma.user.findUnique.mockResolvedValue(buildDbUser({ passwordHash: hash }));

      const result = await service.login({ email: "alice@test.com", password: "password123" });

      expect(result.user.email).toBe("alice@test.com");
      expect(result.tokens.accessToken).toBeDefined();
      expect(reg.user.id).toBe(result.user.id);
    });

    it("rechaza con mensaje genérico si el usuario no existe (anti-enumeración)", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: "nadie@test.com", password: "x" })).rejects.toThrow(
        "invalidCredentials"
      );
    });

    it("rechaza con el MISMO mensaje genérico si la contraseña es incorrecta", async () => {
      // Hash de una contraseña distinta a la que probamos.
      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.hash("la_correcta", 10);
      prisma.user.findUnique.mockResolvedValue(buildDbUser({ passwordHash: hash }));

      await expect(
        service.login({ email: "alice@test.com", password: "la_incorrecta" })
      ).rejects.toThrow("invalidCredentials");
    });
  });

  // ─── VERIFY ──────────────────────────────────────────────────────────────────

  describe("verify", () => {
    it("devuelve valid:true y el payload para un token válido", () => {
      const jwt = new JwtService();
      const token = jwt.sign(
        { sub: "user-123", email: "alice@test.com", username: "alice" },
        { secret: "test_access_secret", expiresIn: "15m" }
      );

      const result = service.verify(token);

      expect(result.valid).toBe(true);
      expect(result.payload?.sub).toBe("user-123");
    });

    it("devuelve valid:false para un token corrupto", () => {
      expect(service.verify("esto.no.es.jwt").valid).toBe(false);
    });

    it("devuelve valid:false para un token firmado con otro secreto", () => {
      const jwt = new JwtService();
      const token = jwt.sign({ sub: "x" }, { secret: "secreto_equivocado" });

      expect(service.verify(token).valid).toBe(false);
    });
  });

  // ─── REFRESH ─────────────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("rota el token: borra la sesión vieja y crea una nueva", async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60); // dentro de 1h
      prisma.session.findUnique.mockResolvedValue({
        id: "session-1",
        userId: "user-123",
        refreshToken: "old-token",
        expiresAt: future
      });
      prisma.user.findUnique.mockResolvedValue(buildDbUser());
      prisma.session.delete.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({});

      const result = await service.refresh("old-token");

      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: "session-1" } });
      expect(prisma.session.create).toHaveBeenCalled();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it("rechaza un refresh token inexistente (401)", async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.refresh("no-existe")).rejects.toThrow("refreshInvalid");
    });

    it("rechaza y borra una sesión expirada", async () => {
      const past = new Date(Date.now() - 1000); // ya caducó
      prisma.session.findUnique.mockResolvedValue({
        id: "session-old",
        userId: "user-123",
        refreshToken: "old",
        expiresAt: past
      });
      prisma.session.delete.mockResolvedValue({});

      await expect(service.refresh("old")).rejects.toThrow("refreshInvalid");
      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: "session-old" } });
    });
  });

  // ─── LOGOUT ──────────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("borra la sesión y devuelve success", async () => {
      prisma.session.findUnique.mockResolvedValue({ id: "session-1", refreshToken: "tok" });
      prisma.session.delete.mockResolvedValue({});

      const result = await service.logout("tok");

      expect(result.success).toBe(true);
      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: "session-1" } });
    });

    it("rechaza si la sesión no existe (404)", async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.logout("no-existe")).rejects.toBeInstanceOf(RpcException);
    });
  });

  // ─── PROFILE ─────────────────────────────────────────────────────────────────

  describe("profile", () => {
    it("devuelve el usuario público desde un token válido", async () => {
      const jwt = new JwtService();
      const token = jwt.sign(
        { sub: "user-123", email: "alice@test.com", username: "alice" },
        { secret: "test_access_secret", expiresIn: "15m" }
      );
      prisma.user.findUnique.mockResolvedValue(buildDbUser());

      const result = await service.profile(token);

      expect(result.user.username).toBe("alice");
      expect("passwordHash" in result.user).toBe(false);
    });

    it("rechaza un token inválido (401)", async () => {
      await expect(service.profile("token.malo")).rejects.toThrow("invalidToken");
    });
  });
});
