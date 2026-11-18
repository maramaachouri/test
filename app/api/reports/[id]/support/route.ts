import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/dal";
import { reportsContainer } from "@/features/reports/infrastructure/reports-container";
import { reportErrorResponse } from "@/features/reports/presentation/report-error-response";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    const { id: reportId } = await context.params;
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        _count: { select: { supports: true } },
        supports: {
          where: { userId: currentUser.id },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { message: "Signalement introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      supportCount: report._count.supports,
      supportedByCurrentUser: report.supports.length > 0,
    });
  } catch (error) {
    return reportErrorResponse(error);
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    // 1. Connecté ?
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    // 2. Exécuter l'action métier
    const { id } = await context.params;
    const result = await reportsContainer.supportReport.execute({
      reportId: id,
      userId: currentUser.id,
    });

    return NextResponse.json(
      { message: "Merci pour votre soutien.", supportCount: result.supportCount },
      { status: 201 }
    );
  } catch (error) {
    return reportErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    const { id: reportId } = await context.params;
    const result = await prisma.$transaction(async (transaction) => {
      const report = await transaction.report.findUnique({
        where: { id: reportId },
        select: { status: true },
      });
      if (!report) {
        return { kind: "not_found" as const };
      }

      const support = await transaction.support.findUnique({
        where: {
          userId_reportId: { userId: currentUser.id, reportId },
        },
        select: { id: true },
      });
      if (!support) {
        return { kind: "support_not_found" as const };
      }

      await transaction.support.delete({ where: { id: support.id } });
      await transaction.reportHistory.create({
        data: {
          reportId,
          oldStatus: report.status,
          newStatus: report.status,
          description: JSON.stringify({
            action: "SUPPORT_DELETED",
            entity: "Support",
            entityId: support.id,
          }),
          userId: currentUser.id,
        },
      });

      const supportCount = await transaction.support.count({
        where: { reportId },
      });
      return { kind: "deleted" as const, supportCount };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { message: "Signalement introuvable." },
        { status: 404 }
      );
    }
    if (result.kind === "support_not_found") {
      return NextResponse.json(
        { message: "Aucun soutien à retirer." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Votre soutien a été retiré.",
      supportCount: result.supportCount,
    });
  } catch (error) {
    return reportErrorResponse(error);
  }
}