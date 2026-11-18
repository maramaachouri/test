
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/dal";
import { hasPermission } from "@/features/auth/domain/permissions";
import { authContainer } from "@/features/auth/infrastructure/auth-container";
import { prisma } from "@/lib/prisma";

import type { UserRole } from "@/features/auth/domain/user";

// GET : récupérer la liste des utilisateurs
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    // Vérifier l'authentification
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    // Vérifier la permission USER_VIEW
    if (!hasPermission(currentUser.role, "USER_VIEW")) {
      return NextResponse.json(
        { message: "Accès interdit. Permission ADMIN requise." },
        { status: 403 }
      );
    }

    const users = await authContainer.listUsers.execute();

    return NextResponse.json(users, { status: 200 });
  } catch (error) {
    console.error("Erreur GET admin users :", error);

    return NextResponse.json(
      { message: "Impossible de récupérer les utilisateurs." },
      { status: 500 }
    );
  }
}

// PATCH : modifier le rôle d'un utilisateur
export async function PATCH(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    // 2. Vérifier la permission ROLE_MANAGE
    if (!hasPermission(currentUser.role, "ROLE_MANAGE")) {
      return NextResponse.json(
        { message: "Accès interdit. Permission ADMIN requise." },
        { status: 403 }
      );
    }

    // 3. Récupérer et vérifier le JSON
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Format JSON invalide." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("id" in body) ||
      !("role" in body)
    ) {
      return NextResponse.json(
        { message: "ID et rôle obligatoires." },
        { status: 400 }
      );
    }

    const { id, role } = body as {
      id: unknown;
      role: unknown;
    };

    // 4. Valider les données
    const validRoles: UserRole[] = ["USER", "MANAGER", "ADMIN"];

    if (
      typeof id !== "string" ||
      !id.trim() ||
      typeof role !== "string" ||
      !validRoles.includes(role as UserRole)
    ) {
      return NextResponse.json(
        { message: "ID ou rôle invalide." },
        { status: 400 }
      );
    }

    // 5. Modifier le rôle via le Use Case
    // Les contrôles d'existence, d'auto-rétrogradation
    // et du dernier administrateur sont centralisés ici.
    const updatedUser = await authContainer.changeUserRole.execute(
      id,
      role as UserRole,
      currentUser.id
    );

    return NextResponse.json(
      {
        message: "Rôle modifié avec succès.",
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    // 6. Gérer les erreurs métier
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND") {
        return NextResponse.json(
          { message: "Utilisateur introuvable." },
          { status: 404 }
        );
      }

      if (error.message === "SELF_ROLE_CHANGE") {
        return NextResponse.json(
          { message: "Vous ne pouvez pas réduire votre propre rôle." },
          { status: 403 }
        );
      }

      if (error.message === "LAST_ADMIN") {
        return NextResponse.json(
          {
            message:
              "Impossible de rétrograder le dernier administrateur.",
          },
          { status: 409 }
        );
      }
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { message: "Conflit de modification. Veuillez réessayer." },
        { status: 409 }
      );
    }

    console.error("Erreur PATCH admin users :", error);

    return NextResponse.json(
      { message: "Impossible de modifier le rôle." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    if (!hasPermission(currentUser.role, "USER_MANAGE")) {
      return NextResponse.json(
        { message: "Accès interdit. Permission ADMIN requise." },
        { status: 403 }
      );
    }

    const userId = request.nextUrl.searchParams.get("id")?.trim();
    if (!userId) {
      return NextResponse.json(
        { message: "Identifiant utilisateur obligatoire." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!target) {
        return { kind: "not_found" as const };
      }
      if (userId === currentUser.id) {
        return { kind: "self_delete" as const };
      }

      if (target.role === "ADMIN") {
        const admins = await transaction.user.count({
          where: { role: "ADMIN" },
        });
        if (admins <= 1) {
          return { kind: "last_admin" as const };
        }
      }

      const [
        createdReports,
        assignedReports,
        comments,
        supports,
        history,
      ] = await Promise.all([
        transaction.report.count({ where: { creatorId: userId } }),
        transaction.report.count({ where: { assignedToId: userId } }),
        transaction.comment.count({ where: { userId } }),
        transaction.support.count({ where: { userId } }),
        transaction.reportHistory.count({ where: { userId } }),
      ]);

      if (createdReports + assignedReports + comments + supports + history > 0) {
        return { kind: "has_activity" as const };
      }

      await transaction.user.delete({ where: { id: userId } });
      return { kind: "deleted" as const };
    }, { isolationLevel: "Serializable" });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { message: "Utilisateur introuvable." },
        { status: 404 }
      );
    }
    if (result.kind === "self_delete") {
      return NextResponse.json(
        { message: "Vous ne pouvez pas supprimer votre propre compte." },
        { status: 403 }
      );
    }
    if (result.kind === "last_admin") {
      return NextResponse.json(
        { message: "Impossible de supprimer le dernier administrateur." },
        { status: 409 }
      );
    }
    if (result.kind === "has_activity") {
      return NextResponse.json(
        { message: "Cet utilisateur possède des signalements ou des traces associées qui doivent être conservés." },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Utilisateur supprimé." });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "P2003" || error.code === "P2034")
    ) {
      return NextResponse.json(
        {
          message:
            error.code === "P2003"
              ? "Cet utilisateur possède des relations qui doivent être conservées."
              : "Conflit de modification. Veuillez réessayer.",
        },
        { status: 409 }
      );
    }

    console.error("Erreur DELETE admin users :", error);
    return NextResponse.json(
      { message: "Impossible de supprimer l'utilisateur." },
      { status: 500 }
    );
  }
}
