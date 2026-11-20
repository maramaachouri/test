
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AssignReport } from "../../features/reports/application/use-cases/assign-report";
import type { ReportRepository } from "../../features/reports/application/ports/report-repository";
import type { Report, UserSummary } from "../../features/reports/domain/report";

describe("AssignReport - Unit Tests", () => {
  let repository: ReportRepository;
  let useCase: AssignReport;

  const report: Report = {
    id: "report-1",
    status: "PENDING",
    creatorId: "user-1",
    assignedToId: null,
  };

  const manager: UserSummary = {
    id: "manager-1",
    name: "Manager Test",
    role: "MANAGER",
  };

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      findUserById: vi.fn(),
      assignReport: vi.fn(),
    } as unknown as ReportRepository;

    useCase = new AssignReport(repository);
  });

  it.each(["USER", "MANAGER"] as const)(
    "should reject %s role",
    async (userRole) => {
      await expect(
        useCase.execute({
          reportId: "report-1",
          managerId: "manager-1",
          adminId: "admin-1",
          userRole,
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(repository.findById).not.toHaveBeenCalled();
    }
  );

  it("should reject assignment if report does not exist", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        reportId: "unknown",
        managerId: "manager-1",
        adminId: "admin-1",
        userRole: "ADMIN",
      })
    ).rejects.toMatchObject({
      code: "REPORT_NOT_FOUND",
    });
  });

  it("should reject assignment if manager does not exist", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);
    vi.mocked(repository.findUserById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        reportId: "report-1",
        managerId: "unknown",
        adminId: "admin-1",
        userRole: "ADMIN",
      })
    ).rejects.toMatchObject({
      code: "ASSIGNEE_NOT_FOUND",
    });
  });

  it("should reject assignment to a user who is not a MANAGER", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);
    vi.mocked(repository.findUserById).mockResolvedValue({
      id: "user-2",
      name: "Regular User",
      role: "USER",
    });

    await expect(
      useCase.execute({
        reportId: "report-1",
        managerId: "user-2",
        adminId: "admin-1",
        userRole: "ADMIN",
      })
    ).rejects.toMatchObject({
      code: "INVALID_ASSIGNEE",
    });
  });

  it("should assign report to a valid MANAGER", async () => {
    vi.mocked(repository.findById).mockResolvedValue(report);
    vi.mocked(repository.findUserById).mockResolvedValue(manager);
    vi.mocked(repository.assignReport).mockResolvedValue(undefined);

    await useCase.execute({
      reportId: "report-1",
      managerId: "manager-1",
      adminId: "admin-1",
      userRole: "ADMIN",
    });

    expect(repository.assignReport).toHaveBeenCalledWith({
      reportId: "report-1",
      managerId: "manager-1",
      managerName: "Manager Test",
      previousManagerId: null,
      currentStatus: "PENDING",
      adminId: "admin-1",
    });
  });

  it("should preserve previous manager during reassignment", async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...report,
      assignedToId: "manager-old",
    });
    vi.mocked(repository.findUserById).mockResolvedValue(manager);

    await useCase.execute({
      reportId: "report-1",
      managerId: "manager-1",
      adminId: "admin-1",
      userRole: "ADMIN",
    });

    expect(repository.assignReport).toHaveBeenCalledWith(
      expect.objectContaining({
        previousManagerId: "manager-old",
      })
    );
  });
});
