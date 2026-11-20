
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const categoryMap = {
  routes: "ROADS",
  eclairage: "LIGHTING",
  "espaces-verts": "GREEN_SPACES",
  proprete: "CLEANLINESS",
  autre: "OTHER",
} as const;

const statusLabels: Record<string, string> = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  REJECTED: "Rejeté",
};

const updateReportSchema = z
  .object({
    title: z.string().trim().min(5).max(120).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    category: z
      .enum([
        "routes",
        "eclairage",
        "espaces-verts",
        "proprete",
        "autre",
      ])
      .optional(),
    location: z.string().trim().min(1).max(200).optional(),
    coordinates: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

function formatReport(
  report: {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    address: string;
    latitude: number;
    longitude: number;
    photoUrl: string | null;
    createdAt: Date;
    creatorId: string;
    assignedToId: string | null;
    assignedTo: { name: string } | null;
    _count: {
      supports: number;
      comments: number;
      history: number;
    };
  },
  currentUser: { id: string; role: string }
) {
  const category =
    Object.entries(categoryMap).find(
      ([, value]) => value === report.category
    )?.[0] ?? "autre";

const canDelete =
  currentUser.role === "USER" &&
  report.creatorId === currentUser.id &&
  report.status === "PENDING" &&
  report._count.comments === 0 &&
  report._count.supports === 0;

  return {
    id: report.id,
    title: report.title,
    description: report.description,
    category,
    location: report.address,
    coordinates: {
      lat: report.latitude,
      lng: report.longitude,
    },
    photoName: report.photoUrl,
    status: statusLabels[report.status] ?? report.status,
    statusCode: report.status,
    supportCount: report._count.supports,
    creatorId: report.creatorId,
    canDelete,
    createdAt: report.createdAt.toISOString(),
    assignedToId: report.assignedToId,
    assignedToName: report.assignedTo?.name ?? null,
  };
}

const reportInclude = {
  _count: {
    select: {
      supports: true,
      comments: true,
      history: true,
    },
  },
  assignedTo: {
    select: {
      name: true,
    },
  },
} as const;

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: reportInclude,
    });

    if (!report) {
      return NextResponse.json(
        { message: "Signalement introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(formatReport(report, user));
  } catch (error) {
    console.error("Erreur GET report :", error);

    return NextResponse.json(
      { message: "Impossible de récupérer le signalement." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Format JSON invalide." },
        { status: 400 }
      );
    }

    const validation = updateReportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Données du signalement invalides." },
        { status: 400 }
      );
    }

    const { id } = await context.params;

    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.report.findUnique({
        where: { id },
      });

      if (!current) {
        return { kind: "not_found" as const };
      }

      const canEdit =
        user.role === "USER" &&
        current.creatorId === user.id &&
        current.status === "PENDING";

      if (!canEdit) {
        return { kind: "forbidden" as const };
      }

      const input = validation.data;

      const data = {
        ...(input.title !== undefined
          ? { title: input.title }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.category !== undefined
          ? { category: categoryMap[input.category] }
          : {}),
        ...(input.location !== undefined
          ? { address: input.location }
          : {}),
        ...(input.coordinates !== undefined
          ? {
              latitude: input.coordinates.lat,
              longitude: input.coordinates.lng,
            }
          : {}),
      };

      const updated = await transaction.report.update({
        where: { id },
        data,
        include: reportInclude,
      });

      await transaction.reportHistory.create({
        data: {
          reportId: id,
          oldStatus: current.status,
          newStatus: current.status,
          description: JSON.stringify({
            action: "REPORT_UPDATED",
            entity: "Report",
            entityId: id,
            oldValue: {
              title: current.title,
              description: current.description,
              category: current.category,
              address: current.address,
              latitude: current.latitude,
              longitude: current.longitude,
            },
            newValue: {
              title: updated.title,
              description: updated.description,
              category: updated.category,
              address: updated.address,
              latitude: updated.latitude,
              longitude: updated.longitude,
            },
          }),
          userId: user.id,
        },
      });

      return {
        kind: "updated" as const,
        report: updated,
      };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { message: "Signalement introuvable." },
        { status: 404 }
      );
    }

    if (result.kind === "forbidden") {
      return NextResponse.json(
        {
          message:
            "Seul le créateur d'un signalement en attente peut le modifier.",
        },
        { status: 403 }
      );
    }

    // Une modification ajoute une nouvelle entrée dans l'historique.
    // On actualise donc le compteur pour renvoyer les bonnes permissions.
    const updatedReport = {
      ...result.report,
      _count: {
        ...result.report._count,
        history: result.report._count.history + 1,
      },
    };

    return NextResponse.json(formatReport(updatedReport, user));
  } catch (error) {
    console.error("Erreur PATCH report :", error);

    return NextResponse.json(
      { message: "Impossible de modifier le signalement." },
      { status: 500 }
    );
  }
}


export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const result = await prisma.$transaction(async (transaction) => {
      const report = await transaction.report.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              history: true,
              comments: true,
              supports: true,
            },
          },
        },
      });

      if (!report) {
        return { kind: "not_found" as const };
      }

      // Seul le propriétaire USER peut supprimer son signalement PENDING.
      const canDelete =
        user.role === "USER" &&
        report.creatorId === user.id &&
        report.status === "PENDING";

      if (!canDelete) {
        return { kind: "forbidden" as const };
      }

      // On refuse la suppression si le signalement possède
      // des commentaires, des soutiens ou plusieurs traces d'historique.
      if (
        report._count.comments > 0 ||
        report._count.supports > 0
            ) {
        return { kind: "has_activity" as const };
      }

      // Supprimer l'historique initial pour éviter l'erreur P2003.
      await transaction.reportHistory.deleteMany({
        where: { reportId: id },
      });

      // Supprimer ensuite le signalement.
      await transaction.report.delete({
        where: { id },
      });

      return { kind: "deleted" as const };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { message: "Signalement introuvable." },
        { status: 404 }
      );
    }

    if (result.kind === "forbidden") {
      return NextResponse.json(
        {
          message:
            "Vous n'êtes pas autorisé à supprimer ce signalement.",
        },
        { status: 403 }
      );
    }

    if (result.kind === "has_activity") {
      return NextResponse.json(
        {
          message:
            "Ce signalement possède des commentaires, soutiens ou traces d'historique qui doivent être conservés.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: "Signalement supprimé avec succès.",
    });
  } catch (error) {
    console.error("Erreur DELETE report :", error);

    return NextResponse.json(
      { message: "Impossible de supprimer le signalement." },
      { status: 500 }
    );
  }
}
