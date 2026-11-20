
import { describe, it, expect, vi, beforeEach } from "vitest";

import { LoginUser } from "../../features/auth/application/use-cases/login-user";
import type { UserRepository } from "../../features/auth/application/ports/user-repository";
import type { SessionRepository } from "../../features/auth/application/ports/session-repository";
import type { PasswordHasher } from "../../features/auth/application/ports/password-hasher";
import type { SessionTokenGenerator } from "../../features/auth/application/ports/session-token-generator";
import type { AuthUser, UserCredentials } from "../../features/auth/domain/user";

describe("LoginUser - Unit Tests", () => {
  let users: UserRepository;
  let sessions: SessionRepository;
  let passwordHasher: PasswordHasher;
  let tokenGenerator: SessionTokenGenerator;
  let useCase: LoginUser;

  const user: UserCredentials = {
    id: "user-1",
    name: "Maram",
    email: "maram@example.com",
    role: "USER",
    passwordHash: "hashed-password",
  };

  const authUser: AuthUser = {
    id: "user-1",
    name: "Maram",
    email: "maram@example.com",
    role: "USER",
  };

  beforeEach(() => {
    users = {
      findByEmail: vi.fn(),
    } as unknown as UserRepository;

    sessions = {
      create: vi.fn(),
    } as unknown as SessionRepository;

    passwordHasher = {
      hash: vi.fn(),
      compare: vi.fn(),
    };

    tokenGenerator = {
      generate: vi.fn(),
      hash: vi.fn(),
    };

    useCase = new LoginUser(
      users,
      sessions,
      passwordHasher,
      tokenGenerator
    );
  });

  it("should reject login if email does not exist", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: "unknown@example.com",
        password: "Password123!",
      })
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    expect(passwordHasher.compare).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it("should reject login if password is incorrect", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(user);
    vi.mocked(passwordHasher.compare).mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: "maram@example.com",
        password: "WrongPassword",
      })
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    expect(sessions.create).not.toHaveBeenCalled();
  });

  it("should normalize email before searching", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: "  MARAM@EXAMPLE.COM  ",
        password: "Password123!",
      })
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    expect(users.findByEmail).toHaveBeenCalledWith("maram@example.com");
  });

  it("should create a session after successful login", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(user);
    vi.mocked(passwordHasher.compare).mockResolvedValue(true);
    vi.mocked(tokenGenerator.generate).mockReturnValue("session-token");
    vi.mocked(tokenGenerator.hash).mockReturnValue("hashed-token");
    vi.mocked(sessions.create).mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed-token",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await useCase.execute({
      email: "maram@example.com",
      password: "Password123!",
    });

    expect(result.sessionToken).toBe("session-token");
    expect(tokenGenerator.generate).toHaveBeenCalled();
    expect(tokenGenerator.hash).toHaveBeenCalledWith("session-token");
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: "hashed-token",
        userId: "user-1",
      })
    );
  });

  it("should return user without password hash", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(user);
    vi.mocked(passwordHasher.compare).mockResolvedValue(true);
    vi.mocked(tokenGenerator.generate).mockReturnValue("session-token");
    vi.mocked(tokenGenerator.hash).mockReturnValue("hashed-token");
    vi.mocked(sessions.create).mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed-token",
      userId: "user-1",
      expiresAt: new Date(),
    });

    const result = await useCase.execute({
      email: "maram@example.com",
      password: "Password123!",
    });

    expect(result.user).toEqual(authUser);
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("should set session expiration to seven days", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(user);
    vi.mocked(passwordHasher.compare).mockResolvedValue(true);
    vi.mocked(tokenGenerator.generate).mockReturnValue("session-token");
    vi.mocked(tokenGenerator.hash).mockReturnValue("hashed-token");
    vi.mocked(sessions.create).mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed-token",
      userId: "user-1",
      expiresAt: new Date(),
    });

    const beforeLogin = Date.now();

    const result = await useCase.execute({
      email: "maram@example.com",
      password: "Password123!",
    });

    const afterLogin = Date.now();

    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      beforeLogin + sevenDays
    );

    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      afterLogin + sevenDays
    );
  });
});
