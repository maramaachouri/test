
import { describe, it, expect, vi, beforeEach } from "vitest";

import { LogoutUser } from "../../features/auth/application/use-cases/logout-user";
import type { SessionRepository } from "../../features/auth/application/ports/session-repository";
import type { SessionTokenGenerator } from "../../features/auth/application/ports/session-token-generator";

describe("LogoutUser - Unit Tests", () => {
  let sessions: SessionRepository;
  let tokenGenerator: SessionTokenGenerator;
  let useCase: LogoutUser;

  beforeEach(() => {
    sessions = {
      findByTokenHash: vi.fn(),
      deleteById: vi.fn(),
    } as unknown as SessionRepository;

    tokenGenerator = {
      hash: vi.fn().mockReturnValue("hashed-token"),
      generate: vi.fn(),
    };

    useCase = new LogoutUser(sessions, tokenGenerator);
  });

  it("should do nothing if token is null", async () => {
    await useCase.execute(null);

    expect(tokenGenerator.hash).not.toHaveBeenCalled();
    expect(sessions.findByTokenHash).not.toHaveBeenCalled();
    expect(sessions.deleteById).not.toHaveBeenCalled();
  });

  it("should do nothing if token is empty", async () => {
    await useCase.execute("");

    expect(tokenGenerator.hash).not.toHaveBeenCalled();
    expect(sessions.findByTokenHash).not.toHaveBeenCalled();
  });

  it("should hash the token before searching for session", async () => {
    vi.mocked(sessions.findByTokenHash).mockResolvedValue(null);

    await useCase.execute("my-session-token");

    expect(tokenGenerator.hash).toHaveBeenCalledWith("my-session-token");
    expect(sessions.findByTokenHash).toHaveBeenCalledWith("hashed-token");
  });

  it("should delete the session if it exists", async () => {
    vi.mocked(sessions.findByTokenHash).mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed-token",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await useCase.execute("my-session-token");

    expect(sessions.deleteById).toHaveBeenCalledWith("session-1");
  });

  it("should not delete anything if session does not exist", async () => {
    vi.mocked(sessions.findByTokenHash).mockResolvedValue(null);

    await useCase.execute("unknown-token");

    expect(sessions.deleteById).not.toHaveBeenCalled();
  });
});
