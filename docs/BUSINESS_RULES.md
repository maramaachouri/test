# Règles métier LocalImpact

## 1. L'adresse e-mail d'un compte est unique

- **Règle :** deux comptes ne peuvent pas partager la même adresse e-mail. L'adresse est normalisée en minuscules et sans espaces périphériques.
- **Conditions :** la validation du format intervient à l'inscription; l'unicité est vérifiée avant création et garantie contre les courses par la contrainte unique PostgreSQL.
- **Emplacements :**
  - `features/auth/presentation/schemas/register-schema.ts`
  - `features/auth/application/use-cases/register-user.ts`
  - `prisma/schema.prisma` (`User.email @unique`)
  - `features/auth/presentation/actions/register-action.ts` (gestion de `P2002`)

## 2. Un utilisateur ne peut soutenir un signalement qu'une fois à la fois

- **Règle :** un couple utilisateur/signalement ne peut posséder qu'un soutien.
- **Conditions :** l'utilisateur doit être connecté et le signalement doit exister. Une tentative répétée retourne un conflit. Un utilisateur peut retirer son soutien puis le rétablir.
- **Emplacements :**
  - `features/reports/application/use-cases/support-report.ts`
  - `features/reports/infrastructure/prisma-report-repository.ts`
  - `prisma/schema.prisma` (`Support.@@unique([userId, reportId])`)
  - `app/api/reports/[id]/support/route.ts` (GET, POST, DELETE)

## 3. Un commentaire contient de 1 à 500 caractères

- **Règle :** après suppression des espaces périphériques, le commentaire ne peut être vide ni dépasser 500 caractères.
- **Conditions :** la règle est validée par l'API et le cas d'utilisation; les modifications de commentaires appliquent la même limite. Seul l'auteur ou un ADMIN peut modifier/supprimer le commentaire.
- **Emplacements :**
  - `features/reports/domain/report-rules.ts` (`MAX_COMMENT_LENGTH`)
  - `features/reports/application/use-cases/add-comment.ts`
  - `app/api/reports/[id]/comments/route.ts`

## 4. Les transitions de statut sont explicites et contrôlées côté serveur

- **Règle :**
  - `PENDING` → `IN_PROGRESS` ou `REJECTED`
  - `IN_PROGRESS` → `RESOLVED` ou `REJECTED`
  - `RESOLVED` et `REJECTED` sont terminaux.
- **Conditions :** un ADMIN peut modifier le statut; un MANAGER ne peut le faire que s'il est affecté au signalement. Une description d'intervention est obligatoire pour passer à `RESOLVED`.
- **Emplacements :**
  - `features/reports/domain/report-rules.ts`
  - `features/reports/application/use-cases/change-report-status.ts`
  - `app/api/reports/[id]/status/route.ts`
  - `features/reports/infrastructure/prisma-report-repository.ts` (transaction statut/historique)

## 5. Le dernier administrateur ne peut être rétrogradé ou supprimé

- **Règle :** LocalImpact doit toujours conserver au moins un utilisateur ADMIN.
- **Conditions :** un ADMIN ne peut pas réduire son propre rôle; le dernier ADMIN ne peut pas être rétrogradé ou supprimé. La suppression d'un compte avec des données métier liées est refusée pour préserver les relations et l'historique.
- **Emplacements :**
  - `features/auth/application/use-cases/change-user-role.ts`
  - `features/auth/infrastructure/prisma-user-repository.ts`
  - `app/api/admin/users/route.ts` (PATCH et DELETE)

Les autres autorisations métier sont explicites : seul ADMIN affecte un signalement à un MANAGER (`features/reports/application/use-cases/assign-report.ts`); seul le créateur d'un signalement en attente ou ADMIN peut modifier/supprimer le signalement; seul l'auteur ou ADMIN peut modifier/supprimer un commentaire.

## Limite de traçabilité connue

`ReportHistory` conserve l'auteur, la date, le signalement et ses statuts, mais ne possède pas de colonnes génériques `actionType`, `entityType`, `entityId` ni de relation permettant d'auditer les utilisateurs sans signalement. Les événements report/comment/support ajoutés utilisent le champ `description` au format JSON pour les métadonnées d'action. Les modifications de rôles et les suppressions de signalements ne sont donc pas complètement auditables sans évolution du schéma. Aucune évolution du schéma n'a été effectuée.
