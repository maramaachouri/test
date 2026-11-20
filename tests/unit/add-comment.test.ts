
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AddComment } from "../../features/reports/application/use-cases/add-comment";
import type { ReportRepository } from "../../features/reports/application/ports/report-repository";
import type { Report } from "../../features/reports/domain/report";
import type { ReportComment } from "../../features/reports/domain/report";

describe("AddComment - Unit Tests", () => {
  let repository: ReportRepository;
  let useCase: AddComment;

  const report: Report = {
    id: "report-1",
    status: "PENDING",
    creatorId: "user-1",
    assignedToId: null,
  };

  const savedComment: ReportComment = {
    id: "comment-1",
    content: "Mon commentaire",
    createdAt: "2026-11-19T20:00:00.000Z",
    authorId: "user-1",
    authorName: "Test User",
  };

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      addComment: vi.fn(),
    } as unknown as ReportRepository;

    useCase = new AddComment(repository);
  });

  it("should reject comment when report does not exist", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        reportId: "unknown",
        userId: "user-1",
        content: "Mon commentaire",
      })
    ).rejects.toMatchObject({
      code: "REPORT_NOT_FOUND",
    });
  });

  it("should reject an empty comment", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);

    await expect(
      useCase.execute({
        reportId: "report-1",
        userId: "user-1",
        content: "",
      })
    ).rejects.toMatchObject({
      code: "COMMENT_EMPTY",
    });
  });

  it("should reject a comment containing only spaces", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);

    await expect(
      useCase.execute({
        reportId: "report-1",
        userId: "user-1",
        content: "     ",
      })
    ).rejects.toMatchObject({
      code: "COMMENT_EMPTY",
    });
  });

  it("should reject a comment longer than 500 characters", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);

    await expect(
      useCase.execute({
        reportId: "report-1",
        userId: "user-1",
        content: "a".repeat(501),
      })
    ).rejects.toMatchObject({
      code: "COMMENT_TOO_LONG",
    });
  });

  it("should accept a valid comment", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);
    vi.mocked(repository.addComment).mockResolvedValue(savedComment);

    const result = await useCase.execute({
      reportId: "report-1",
      userId: "user-1",
      content: "Mon commentaire",
    });

    expect(result).toEqual(savedComment);
    expect(repository.addComment).toHaveBeenCalledWith(
      "report-1",
      "user-1",
      "Mon commentaire"
    );
  });

  it("should trim spaces before saving the comment", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);
    vi.mocked(repository.addComment).mockResolvedValue(savedComment);

    await useCase.execute({
      reportId: "report-1",
      userId: "user-1",
      content: "  Mon commentaire  ",
    });

    expect(repository.addComment).toHaveBeenCalledWith(
      "report-1",
      "user-1",
      "Mon commentaire"
    );
  });
});
