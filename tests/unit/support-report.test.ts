
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupportReport } from "../../features/reports/application/use-cases/support-report";
import type { ReportRepository } from "../../features/reports/application/ports/report-repository";
import type { Report } from "../../features/reports/domain/report";

describe("SupportReport - Unit Tests", () => {
  let repository: ReportRepository;
  let useCase: SupportReport;

  const report: Report = {
    id: "report-1",
    status: "PENDING",
    creatorId: "user-1",
    assignedToId: null,
  };

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      hasUserSupported: vi.fn(),
      addSupport: vi.fn(),
      countSupports: vi.fn(),
    } as unknown as ReportRepository;

    useCase = new SupportReport(repository);
  });

  it("should reject support if report does not exist", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        reportId: "unknown",
        userId: "user-1",
      })
    ).rejects.toMatchObject({
      code: "REPORT_NOT_FOUND",
    });

    expect(repository.addSupport).not.toHaveBeenCalled();
  });

  it("should reject support if user has already supported the report", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);
    vi.mocked(repository.hasUserSupported).mockResolvedValue(true);

    await expect(
      useCase.execute({
        reportId: "report-1",
        userId: "user-1",
      })
    ).rejects.toMatchObject({
      code: "ALREADY_SUPPORTED",
    });

    expect(repository.addSupport).not.toHaveBeenCalled();
  });

  it("should add support if user has not supported the report", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);
    vi.mocked(repository.hasUserSupported).mockResolvedValue(false);
    vi.mocked(repository.addSupport).mockResolvedValue(undefined);
    vi.mocked(repository.countSupports).mockResolvedValue(5);

    await useCase.execute({
      reportId: "report-1",
      userId: "user-2",
    });

    expect(repository.addSupport).toHaveBeenCalledWith(
      "report-1",
      "user-2"
    );
  });

  it("should return the updated support count", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);
    vi.mocked(repository.hasUserSupported).mockResolvedValue(false);
    vi.mocked(repository.addSupport).mockResolvedValue(undefined);
    vi.mocked(repository.countSupports).mockResolvedValue(6);

    const result = await useCase.execute({
      reportId: "report-1",
      userId: "user-2",
    });

    expect(result).toEqual({
      supportCount: 6,
    });
  });
});
