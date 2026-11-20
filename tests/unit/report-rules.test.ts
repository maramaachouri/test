
import { describe, it, expect } from "vitest";

import {
  canChangeReportStatus,
  getAllowedNextStatuses,
  MAX_COMMENT_LENGTH,
} from "../../features/reports/domain/report-rules";

describe("Report Rules - Unit Tests", () => {
  describe("canChangeReportStatus", () => {
    it("should allow PENDING to IN_PROGRESS", () => {
      expect(canChangeReportStatus("PENDING", "IN_PROGRESS")).toBe(true);
    });

    it("should allow PENDING to REJECTED", () => {
      expect(canChangeReportStatus("PENDING", "REJECTED")).toBe(true);
    });

    it("should allow IN_PROGRESS to RESOLVED", () => {
      expect(canChangeReportStatus("IN_PROGRESS", "RESOLVED")).toBe(true);
    });

    it("should allow IN_PROGRESS to REJECTED", () => {
      expect(canChangeReportStatus("IN_PROGRESS", "REJECTED")).toBe(true);
    });

    it("should reject invalid transitions", () => {
      expect(canChangeReportStatus("PENDING", "RESOLVED")).toBe(false);
      expect(canChangeReportStatus("RESOLVED", "PENDING")).toBe(false);
      expect(canChangeReportStatus("REJECTED", "IN_PROGRESS")).toBe(false);
    });
  });

  describe("getAllowedNextStatuses", () => {
    it("should return allowed statuses for PENDING", () => {
      expect(getAllowedNextStatuses("PENDING")).toEqual([
        "IN_PROGRESS",
        "REJECTED",
      ]);
    });

    it("should return allowed statuses for IN_PROGRESS", () => {
      expect(getAllowedNextStatuses("IN_PROGRESS")).toEqual([
        "RESOLVED",
        "REJECTED",
      ]);
    });

    it("should return an empty array for RESOLVED", () => {
      expect(getAllowedNextStatuses("RESOLVED")).toEqual([]);
    });

    it("should return an empty array for REJECTED", () => {
      expect(getAllowedNextStatuses("REJECTED")).toEqual([]);
    });
  });

  describe("MAX_COMMENT_LENGTH", () => {
    it("should be equal to 500", () => {
      expect(MAX_COMMENT_LENGTH).toBe(500);
    });
  });
});
