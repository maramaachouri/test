
import { describe, it, expect, vi, beforeEach } from "vitest";

import { VerifySession } from "../../features/auth/application/use-cases/verify-session";
import type { SessionRepository } from "../../features/auth/application/ports/session-repository";
import type { UserRepository } from "../../features/auth/application/ports/user-repository";
import type { SessionTokenGenerator } from "../../features/auth/application/ports/session-token-generator";
import type { AuthUser } from "../../features/auth/domain/user";

describe("VerifySession - Unit Tests", () => {
  let sessions: SessionRepository;
  let users: UserRepository;
  let tokenGenerator: SessionTokenGenerator;
  let useCase: VerifySession;

  const authUser: AuthUser = {
    id: "user-1",
    name: "Maram",
    email: "maram@example.com",
    role: "USER",
  };

  beforeEach(() => {
    sessions = {
      findByTokenHash: vi.fn(),
      deleteById: vi.fn(),
    } as unknown as SessionRepository;

    users = {
      findById: vi.fn(),
    } as unknown as UserRepository;

    tokenGenerator = {
      hash: vi.fn().mockReturnValue("hashed-token"),
      generate: vi.fn(),
    };

    useCase = new VerifySession(sessions, users, tokenGenerator);
  });

  it("should reject an empty token", async () => {
    await expect(useCase.execute("")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });

    expect(sessions.findByTokenHash).not.toHaveBeenCalled();
  });

  it("should reject an invalid session", async () => {
    vi.mocked(sessions.findByTokenHash).mockResolvedValue(null);

    await expect(useCase.execute("invalid-token")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });

    expect(tokenGenerator.hash).toHaveBeenCalledWith("invalid-token");
  });

  it("should delete an expired session", async () => {
    vi.mocked(sessions.findByTokenHash).mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed-token",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(useCase.execute("expired-token")).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });

    expect(sessions.deleteById).toHaveBeenCalledWith("session-1");
    expect(users.findById).not.toHaveBeenCalled();
  });

  it("should delete session if associated user does not exist", async () => {
    vi.mocked(sessions.findByTokenHash).mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed-token",
      userId: "unknown-user",
      expiresAt: new Date(Date.now() + 60_000),
    });

    vi.mocked(users.findById).mockResolvedValue(null);

    await expect(useCase.execute("valid-token")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });

    expect(sessions.deleteById).toHaveBeenCalledWith("session-1");
  });

  it("should return user for a valid session", async () => {
    vi.mocked(sessions.findByTokenHash).mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed-token",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    vi.mocked(users.findById).mockResolvedValue(authUser);

    const result = await useCase.execute("valid-token");

    expect(result).toEqual(authUser);
    expect(sessions.deleteById).not.toHaveBeenCalled();
  });

  it("should hash token before searching for session", async () => {
    vi.mocked(sessions.findByTokenHash).mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed-token",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    vi.mocked(users.findById).mockResolvedValue(authUser);

    await useCase.execute("my-secret-token");

    expect(tokenGenerator.hash).toHaveBeenCalledWith("my-secret-token");
    expect(sessions.findByTokenHash).toHaveBeenCalledWith("hashed-token");
  });
});
