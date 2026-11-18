import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { reportsContainer } from "@/features/reports/infrastructure/reports-container";
import { MAX_COMMENT_LENGTH } from "@/features/reports/domain/report-rules";
import { reportErrorResponse } from "@/features/reports/presentation/report-error-response";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const commentSchema = z.object({
  content: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
});
const updateCommentSchema = z.object({
  commentId: z.string().min(1),
  content: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
});
const deleteCommentSchema = z.object({
  commentId: z.string().min(1),
});

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { message: "Vous devez être connecté." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const comments = await reportsContainer.listComments.execute({
      reportId: id,
    });

    return NextResponse.json(comments);
  } catch (error) {
    return reportErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
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

    const validation = commentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Le commentaire doit contenir de 1 à 500 caractères." },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const comment = await reportsContainer.addComment.execute({
      reportId: id,
      userId: currentUser.id,
      content: validation.data.content,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return reportErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
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

    const validation = updateCommentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: "Données de commentaire invalides." },
        { status: 400 }
      );
    }

    const { id: reportId } = await context.params;
    const result = await prisma.$transaction(async (transaction) => {
      const [report, comment] = await Promise.all([
        transaction.report.findUnique({
          where: { id: reportId },
          select: { status: true },
        }),
        transaction.comment.findFirst({
          where: { id: validation.data.commentId, reportId },
        }),
      ]);

      if (!report || !comment) {
        return { kind: "not_found" as const };
      }
      if (comment.userId !== currentUser.id && currentUser.role !== "ADMIN") {
        return { kind: "forbidden" as const };
      }

      const updatedComment = await transaction.comment.update({
        where: { id: comment.id },
        data: { content: validation.data.content },
        include: { user: { select: { name: true } } },
      });

      await transaction.reportHistory.create({
        data: {
          reportId,
          oldStatus: report.status,
          newStatus: report.status,
          description: JSON.stringify({
            action: "COMMENT_UPDATED",
            entity: "Comment",
            entityId: comment.id,
            oldValue: comment.content,
            newValue: updatedComment.content,
          }),
          userId: currentUser.id,
        },
      });

      return { kind: "updated" as const, comment: updatedComment };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { message: "Commentaire ou signalement introuvable." },
        { status: 404 }
      );
    }
    if (result.kind === "forbidden") {
      return NextResponse.json(
        { message: "Vous ne pouvez modifier que vos propres commentaires." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      comment: {
        id: result.comment.id,
        content: result.comment.content,
        createdAt: result.comment.createdAt.toISOString(),
        authorId: result.comment.user.id,
        authorName: result.comment.user.name,
      },
    });
  } catch (error) {
    return reportErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
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

    const validation = deleteCommentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: "Identifiant de commentaire invalide." },
        { status: 400 }
      );
    }

    const { id: reportId } = await context.params;
    const result = await prisma.$transaction(async (transaction) => {
      const [report, comment] = await Promise.all([
        transaction.report.findUnique({
          where: { id: reportId },
          select: { status: true },
        }),
        transaction.comment.findFirst({
          where: { id: validation.data.commentId, reportId },
        }),
      ]);

      if (!report || !comment) {
        return { kind: "not_found" as const };
      }
      if (comment.userId !== currentUser.id && currentUser.role !== "ADMIN") {
        return { kind: "forbidden" as const };
      }

      await transaction.comment.delete({ where: { id: comment.id } });
      await transaction.reportHistory.create({
        data: {
          reportId,
          oldStatus: report.status,
          newStatus: report.status,
          description: JSON.stringify({
            action: "COMMENT_DELETED",
            entity: "Comment",
            entityId: comment.id,
            oldValue: comment.content,
          }),
          userId: currentUser.id,
        },
      });

      return { kind: "deleted" as const };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { message: "Commentaire ou signalement introuvable." },
        { status: 404 }
      );
    }
    if (result.kind === "forbidden") {
      return NextResponse.json(
        { message: "Vous ne pouvez supprimer que vos propres commentaires." },
        { status: 403 }
      );
    }

    return NextResponse.json({ message: "Commentaire supprimé." });
  } catch (error) {
    return reportErrorResponse(error);
  }
}
