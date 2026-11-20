
import type { UserRole } from "@/features/auth/domain/user";
import type { ReportStatus } from "./report";

interface ReportPermissionContext {
  role: UserRole;
  userId: string;
  creatorId: string;
  status: ReportStatus;
  commentsCount: number;
  supportsCount: number;
}

export function canEditReport(
  report: ReportPermissionContext
): boolean {
  return (
    report.role === "USER" &&
    report.userId === report.creatorId &&
    report.status === "PENDING"
  );
}

export function canDeleteReport(
  report: ReportPermissionContext
): boolean {
  return (
    report.role === "USER" &&
    report.userId === report.creatorId &&
    report.status === "PENDING" &&
    report.commentsCount === 0 &&
    report.supportsCount === 0
  );
}
