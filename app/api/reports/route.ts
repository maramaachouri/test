
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";

const categoryMap: Record<
  string,
  "ROADS" | "LIGHTING" | "GREEN_SPACES" | "CLEANLINESS" | "OTHER"
> = {
  routes: "ROADS",
  eclairage: "LIGHTING",
  "espaces-verts": "GREEN_SPACES",
  proprete: "CLEANLINESS",
  autre: "OTHER",
};

const statusMap: Record<string, string> = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  REJECTED: "Rejeté",
};

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
    assignedToId?: string | null;
    assignedTo?: { name: string } | null;
    _count?: {
      supports: number;
      comments: number;
      history: number;
    };
  },
  currentUser: { id: string; role: string }
) {
  const canDelete =
    (
      currentUser.role === "ADMIN" ||
      (report.creatorId === currentUser.id && report.status === "PENDING")
    ) &&
    (report._count?.comments ?? 0) === 0 &&
    (report._count?.supports ?? 0) === 0 &&
    (report._count?.history ?? 0) === 0;

  return {
    id: report.id,
    title: report.title,
    description: report.description,
    category:
      Object.entries(categoryMap).find(
        ([, value]) => value === report.category
      )?.[0] ?? "autre",
    location: report.address,
    coordinates: {
      lat: report.latitude,
      lng: report.longitude,
    },
    photoName: report.photoUrl,
    status: statusMap[report.status] ?? report.status,
    statusCode: report.status,
    supportCount: report._count?.supports ?? 0,
    creatorId: report.creatorId,
    canDelete,
    assignedToId: report.assignedToId ?? null,
    assignedToName: report.assignedTo?.name ?? null,
    createdAt: report.createdAt.toISOString(),
  };
}

// GET : récupérer tous les signalements
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            supports: true,
            comments: true,
            history: true,
          },
        },
        assignedTo: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(
      reports.map((report) => formatReport(report, currentUser))
    );
  } catch (error) {
    console.error("Erreur GET reports :", error);

    return NextResponse.json(
      { message: "Impossible de récupérer les signalements." },
      { status: 500 }
    );
  }
}

// POST : créer un signalement
export async function POST(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Format JSON invalide." },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { message: "Données du signalement invalides." },
        { status: 400 }
      );
    }

    const { title, description, category, location, coordinates } = body as {
      title?: unknown;
      description?: unknown;
      category?: unknown;
      location?: unknown;
      coordinates?: { lat?: unknown; lng?: unknown };
    };

    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof category !== "string" ||
      typeof location !== "string" ||
      !coordinates ||
      typeof coordinates.lat !== "number" ||
      typeof coordinates.lng !== "number"
    ) {
      return NextResponse.json(
        {
          message:
            "Veuillez fournir toutes les informations obligatoires, y compris la position sur la carte.",
        },
        { status: 400 }
      );
    }

    const latitude = coordinates.lat;
    const longitude = coordinates.lng;

    if (
      title.trim().length < 5 ||
      title.trim().length > 120 ||
      description.trim().length < 10 ||
      description.trim().length > 2000 ||
      location.trim().length < 1 ||
      location.trim().length > 200 ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !categoryMap[category]
    ) {
      return NextResponse.json(
        { message: "Les informations du signalement sont invalides." },
        { status: 400 }
      );
    }

    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          message:
            "Vous devez être connecté pour créer un signalement.",
        },
        { status: 401 }
      );
    }

    const report = await prisma.$transaction(async (transaction) => {
      const createdReport = await transaction.report.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          category: categoryMap[category],
          address: location.trim(),
          latitude,
          longitude,
          creatorId: currentUser.id,
        },
      });

      await transaction.reportHistory.create({
        data: {
          reportId: createdReport.id,
          oldStatus: null,
          newStatus: createdReport.status,
          description: JSON.stringify({
            action: "REPORT_CREATED",
            entity: "Report",
            entityId: createdReport.id,
            newValue: {
              title: createdReport.title,
              description: createdReport.description,
              category: createdReport.category,
              address: createdReport.address,
              latitude: createdReport.latitude,
              longitude: createdReport.longitude,
            },
          }),
          userId: currentUser.id,
        },
      });

      return createdReport;
    });

    return NextResponse.json(
      {
        ...formatReport(
          {
            ...report,
            _count: {
              supports: 0,
              comments: 0,
              history: 1,
            },
          },
          currentUser
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur POST reports :", error);

    return NextResponse.json(
      { message: "Impossible de créer le signalement." },
      { status: 500 }
    );
  }
}
