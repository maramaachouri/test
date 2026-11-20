
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ChangeReportStatus } from "../../features/reports/application/use-cases/change-report-status";
import { ReportError } from "../../features/reports/domain/report-error";
import type { ReportRepository } from "../../features/reports/application/ports/report-repository";
import type { Report } from "../../features/reports/domain/report";

describe("ChangeReportStatus - Unit Tests", () => {
  let repository: ReportRepository;
  let useCase: ChangeReportStatus;

  const report: Report = {
    id: "report-1",
    status: "PENDING",
    creatorId: "user-1",
    assignedToId: "manager-1",
  };

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      updateStatusAndCreateHistory: vi.fn(),
    } as unknown as ReportRepository;

    useCase = new ChangeReportStatus(repository);
  });

  it("should throw REPORT_NOT_FOUND if report does not exist", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        reportId: "unknown",
        newStatus: "IN_PROGRESS",
        description: null,
        userId: "manager-1",
        userRole: "MANAGER",
      })
    ).rejects.toMatchObject({
      code: "REPORT_NOT_FOUND",
    });
  });

  it("should reject USER trying to change report status", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);

    await expect(
      useCase.execute({
        reportId: "report-1",
        newStatus: "IN_PROGRESS",
        description: null,
        userId: "user-1",
        userRole: "USER",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should reject MANAGER who is not assigned to the report", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);

    await expect(
      useCase.execute({
        reportId: "report-1",
        newStatus: "IN_PROGRESS",
        description: null,
        userId: "manager-2",
        userRole: "MANAGER",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should reject an invalid status transition", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);

    await expect(
      useCase.execute({
        reportId: "report-1",
        newStatus: "RESOLVED",
        description: "Intervention terminée",
        userId: "manager-1",
        userRole: "MANAGER",
      })
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });
  });


  it("should allow assigned MANAGER to resolve a report with a description", async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...report,
      status: "IN_PROGRESS",
    });

    await useCase.execute({
      reportId: "report-1",
      newStatus: "RESOLVED",
      description: "Intervention terminée",
      userId: "manager-1",
      userRole: "MANAGER",
    });

    expect(repository.updateStatusAndCreateHistory).toHaveBeenCalledWith({
      reportId: "report-1",
      oldStatus: "IN_PROGRESS",
      newStatus: "RESOLVED",
      description: "Intervention terminée",
      userId: "manager-1",
    });
  });

  it("should allow ADMIN to change report status", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);

    await useCase.execute({
      reportId: "report-1",
      newStatus: "IN_PROGRESS",
      description: null,
      userId: "admin-1",
      userRole: "ADMIN",
    });

    expect(repository.updateStatusAndCreateHistory).toHaveBeenCalled();
  });

  it("should reject resolution without a description", async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...report,
      status: "IN_PROGRESS",
    });

    await expect(
      useCase.execute({
        reportId: "report-1",
        newStatus: "RESOLVED",
        description: "   ",
        userId: "manager-1",
        userRole: "MANAGER",
      })
    ).rejects.toMatchObject({
      code: "RESOLUTION_DESCRIPTION_REQUIRED",
    });
  });

  it("should trim the resolution description before saving", async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...report,
      status: "IN_PROGRESS",
    });

    await useCase.execute({
      reportId: "report-1",
      newStatus: "RESOLVED",
      description: "  Intervention terminée  ",
      userId: "manager-1",
      userRole: "MANAGER",
    });

    expect(repository.updateStatusAndCreateHistory).toHaveBeenCalledWith({
      reportId: "report-1",
      oldStatus: "IN_PROGRESS",
      newStatus: "RESOLVED",
      description: "Intervention terminée",
      userId: "manager-1",
    });
  });

});
