
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RegisterUser } from "../../features/auth/application/use-cases/register-user";
import type { UserRepository } from "../../features/auth/application/ports/user-repository";
import type { PasswordHasher } from "../../features/auth/application/ports/password-hasher";
import type { AuthUser, UserCredentials } from "../../features/auth/domain/user";

describe("RegisterUser - Unit Tests", () => {
  let users: UserRepository;
  let passwordHasher: PasswordHasher;
  let useCase: RegisterUser;

  const createdUser: AuthUser = {
    id: "user-1",
    name: "Maram",
    email: "maram@example.com",
    role: "USER",
  };

  beforeEach(() => {
    users = {
      findByEmail: vi.fn(),
      create: vi.fn(),
    } as unknown as UserRepository;

    passwordHasher = {
      hash: vi.fn(),
      compare: vi.fn(),
    };

    useCase = new RegisterUser(users, passwordHasher);
  });

  it("should reject registration if email already exists", async () => {
    const existingUser = {
      id: "user-1",
      email: "maram@example.com",
      passwordHash: "hashed-password",
      role: "USER",
    } as UserCredentials;

    vi.mocked(users.findByEmail).mockResolvedValue(existingUser);

    await expect(
      useCase.execute({
        name: "Maram",
        email: "maram@example.com",
        password: "Password123!",
      })
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
  });

  it("should normalize email to lowercase and remove spaces", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(null);
    vi.mocked(passwordHasher.hash).mockResolvedValue("hashed-password");
    vi.mocked(users.create).mockResolvedValue(createdUser);

    await useCase.execute({
      name: "Maram",
      email: "  MARAM@EXAMPLE.COM  ",
      password: "Password123!",
    });

    expect(users.findByEmail).toHaveBeenCalledWith("maram@example.com");
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "maram@example.com",
      })
    );
  });

  it("should trim spaces from the user's name", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(null);
    vi.mocked(passwordHasher.hash).mockResolvedValue("hashed-password");
    vi.mocked(users.create).mockResolvedValue(createdUser);

    await useCase.execute({
      name: "  Maram  ",
      email: "maram@example.com",
      password: "Password123!",
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Maram",
      })
    );
  });

  it("should hash the password before creating the user", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(null);
    vi.mocked(passwordHasher.hash).mockResolvedValue("hashed-password");
    vi.mocked(users.create).mockResolvedValue(createdUser);

    await useCase.execute({
      name: "Maram",
      email: "maram@example.com",
      password: "Password123!",
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith("Password123!");

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: "hashed-password",
      })
    );
  });

  it("should return the created user after successful registration", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(null);
    vi.mocked(passwordHasher.hash).mockResolvedValue("hashed-password");
    vi.mocked(users.create).mockResolvedValue(createdUser);

    const result = await useCase.execute({
      name: "Maram",
      email: "maram@example.com",
      password: "Password123!",
    });

    expect(result).toEqual(createdUser);
  });

  it("should not create a user if password hashing fails", async () => {
    vi.mocked(users.findByEmail).mockResolvedValue(null);
    vi.mocked(passwordHasher.hash).mockRejectedValue(
      new Error("Hashing failed")
    );

    await expect(
      useCase.execute({
        name: "Maram",
        email: "maram@example.com",
        password: "Password123!",
      })
    ).rejects.toThrow("Hashing failed");

    expect(users.create).not.toHaveBeenCalled();
  });
});
