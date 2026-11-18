import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getActivitySummary(description: string | null): string {
  if (!description) {
    return "Activité enregistrée";
  }

  try {
    const metadata: unknown = JSON.parse(description);
    if (typeof metadata !== "object" || metadata === null || !("action" in metadata)) {
      return "Statut ou affectation mis à jour";
    }

    switch (metadata.action) {
      case "REPORT_CREATED":
        return "Signalement créé";
      case "REPORT_UPDATED":
        return "Signalement modifié";
      case "REPORT_ASSIGNED":
        return "Signalement affecté";
      case "REPORT_STATUS_CHANGED":
        return "Statut modifié";
      case "COMMENT_CREATED":
        return "Commentaire ajouté";
      case "COMMENT_UPDATED":
        return "Commentaire modifié";
      case "COMMENT_DELETED":
        return "Commentaire supprimé";
      case "SUPPORT_CREATED":
        return "Nouveau soutien";
      case "SUPPORT_DELETED":
        return "Soutien retiré";
      default:
        return "Activité enregistrée";
    }
  } catch {
    return "Statut ou affectation mis à jour";
  }
}

export async function GET() {
  try {
    const [
      total,
      pending,
      inProgress,
      resolved,
      rejected,
      byCategory,
      recentActivities,
    ] =
      await prisma.$transaction([
        prisma.report.count(),
        prisma.report.count({ where: { status: "PENDING" } }),
        prisma.report.count({ where: { status: "IN_PROGRESS" } }),
        prisma.report.count({ where: { status: "RESOLVED" } }),
        prisma.report.count({ where: { status: "REJECTED" } }),
        prisma.report.groupBy({
          by: ["category"],
          _count: { _all: true },
          orderBy: { category: "asc" },
        }),
        prisma.reportHistory.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            reportId: true,
            oldStatus: true,
            newStatus: true,
            description: true,
            createdAt: true,
            report: { select: { title: true } },
          },
        }),
      ]);

    return NextResponse.json({
      total,
      pending,
      inProgress,
      resolved,
      rejected,
      byCategory: Object.fromEntries(
        byCategory.map((item) => [item.category, item._count._all])
      ),
      recentActivities: recentActivities.map((activity) => ({
        id: activity.id,
        reportId: activity.reportId,
        reportTitle: activity.report.title,
        oldStatus: activity.oldStatus,
        newStatus: activity.newStatus,
        description: getActivitySummary(activity.description),
        createdAt: activity.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Erreur GET report stats :", error);
    return NextResponse.json(
      { message: "Impossible de récupérer les statistiques." },
      { status: 500 }
    );
  }
}
