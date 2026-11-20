
import { describe, it, expect } from "vitest";

import {
  hasPermission,
  getPermissionsForRole,
} from "../../features/auth/domain/permissions";

describe("Permissions - Unit Tests", () => {
  describe("USER permissions", () => {
    it("should allow basic report permissions", () => {
      expect(hasPermission("USER", "REPORT_CREATE")).toBe(true);
      expect(hasPermission("USER", "REPORT_VIEW")).toBe(true);
      expect(hasPermission("USER", "REPORT_COMMENT")).toBe(true);
      expect(hasPermission("USER", "REPORT_SUPPORT")).toBe(true);
    });

    it("should not allow management permissions", () => {
      expect(hasPermission("USER", "REPORT_MANAGE")).toBe(false);
      expect(hasPermission("USER", "USER_MANAGE")).toBe(false);
      expect(hasPermission("USER", "ROLE_MANAGE")).toBe(false);
    });
  });

  describe("MANAGER permissions", () => {
    it("should allow report management", () => {
      expect(hasPermission("MANAGER", "REPORT_CREATE")).toBe(true);
      expect(hasPermission("MANAGER", "REPORT_VIEW")).toBe(true);
      expect(hasPermission("MANAGER", "REPORT_MANAGE")).toBe(true);
    });

    it("should not allow user and role management", () => {
      expect(hasPermission("MANAGER", "USER_VIEW")).toBe(false);
      expect(hasPermission("MANAGER", "USER_MANAGE")).toBe(false);
      expect(hasPermission("MANAGER", "ROLE_MANAGE")).toBe(false);
    });
  });

  describe("ADMIN permissions", () => {
    it("should have all permissions", () => {
      const permissions = getPermissionsForRole("ADMIN");

      expect(permissions).toHaveLength(8);

      expect(hasPermission("ADMIN", "REPORT_CREATE")).toBe(true);
      expect(hasPermission("ADMIN", "REPORT_VIEW")).toBe(true);
      expect(hasPermission("ADMIN", "REPORT_COMMENT")).toBe(true);
      expect(hasPermission("ADMIN", "REPORT_SUPPORT")).toBe(true);
      expect(hasPermission("ADMIN", "REPORT_MANAGE")).toBe(true);
      expect(hasPermission("ADMIN", "USER_VIEW")).toBe(true);
      expect(hasPermission("ADMIN", "USER_MANAGE")).toBe(true);
      expect(hasPermission("ADMIN", "ROLE_MANAGE")).toBe(true);
    });
  });

  describe("getPermissionsForRole", () => {
    it("should return 4 permissions for USER", () => {
      expect(getPermissionsForRole("USER")).toHaveLength(4);
    });

    it("should return 5 permissions for MANAGER", () => {
      expect(getPermissionsForRole("MANAGER")).toHaveLength(5);
    });

    it("should return 8 permissions for ADMIN", () => {
      expect(getPermissionsForRole("ADMIN")).toHaveLength(8);
    });
  });
});
