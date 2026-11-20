
import { describe, it, expect } from "vitest";

import {
  canEditReport,
  canDeleteReport,
} from "../../features/reports/domain/report-permissions";

const baseReport = {
  userId: "user-1",
  creatorId: "user-1",
  status: "PENDING" as const,
  commentsCount: 0,
  supportsCount: 0,
};

describe("Report permissions - Unit Tests", () => {
  describe("canEditReport", () => {
    it("allows the owner USER to edit a pending report", () => {
      expect(
        canEditReport({ ...baseReport, role: "USER" })
      ).toBe(true);
    });

    it("denies editing by a non-owner USER", () => {
      expect(
        canEditReport({
          ...baseReport,
          role: "USER",
          userId: "user-2",
        })
      ).toBe(false);
    });

    it("denies editing by ADMIN", () => {
      expect(
        canEditReport({ ...baseReport, role: "ADMIN" })
      ).toBe(false);
    });

    it("denies editing by MANAGER", () => {
      expect(
        canEditReport({ ...baseReport, role: "MANAGER" })
      ).toBe(false);
    });

    it("denies editing a non-pending report", () => {
      expect(
        canEditReport({
          ...baseReport,
          role: "USER",
          status: "IN_PROGRESS",
        })
      ).toBe(false);
    });
  });

  describe("canDeleteReport", () => {
    it("allows the owner USER to delete an eligible report", () => {
      expect(
        canDeleteReport({ ...baseReport, role: "USER" })
      ).toBe(true);
    });

    it("denies deletion by a non-owner USER", () => {
      expect(
        canDeleteReport({
          ...baseReport,
          role: "USER",
          userId: "user-2",
        })
      ).toBe(false);
    });

    it("denies deletion by ADMIN", () => {
      expect(
        canDeleteReport({ ...baseReport, role: "ADMIN" })
      ).toBe(false);
    });

    it("denies deletion by MANAGER", () => {
      expect(
        canDeleteReport({ ...baseReport, role: "MANAGER" })
      ).toBe(false);
    });

    it("denies deletion when comments exist", () => {
      expect(
        canDeleteReport({
          ...baseReport,
          role: "USER",
          commentsCount: 1,
        })
      ).toBe(false);
    });

    it("denies deletion when supports exist", () => {
      expect(
        canDeleteReport({
          ...baseReport,
          role: "USER",
          supportsCount: 1,
        })
      ).toBe(false);
    });

    it("denies deletion when report is not pending", () => {
      expect(
        canDeleteReport({
          ...baseReport,
          role: "USER",
          status: "RESOLVED",
        })
      ).toBe(false);
    });
  });
});
