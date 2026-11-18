# Rapport des corrections fonctionnelles

Date : 2026-11-18

## Portée

Corrections limitées au code fonctionnel. Aucun test automatisé ou manuel n'a été exécuté et aucun fichier de test n'a été créé ou modifié. Aucune migration ni modification de `schema.prisma` n'a été effectuée, conformément au refus de changement de schéma.

## Fonctionnalités initialement incomplètes

- Les signalements n'avaient pas d'API de lecture individuelle, modification ou suppression.
- Les commentaires pouvaient être listés et créés, mais pas modifiés ou supprimés par API.
- Les soutiens pouvaient être créés et comptés, mais pas consultés individuellement ni retirés.
- L'administration des utilisateurs permettait de lister et modifier les rôles, mais pas de supprimer les comptes.
- Le tableau de bord calculait côté client une partie des statistiques à partir de la liste complète et ne présentait pas les quatre statuts.
- Les événements sensibles hors changement de statut/affectation n'étaient pas visibles dans `ReportHistory`.

## Corrections et état

| Exigence | État | Détail |
|---|---|---|
| Report Create | COMPLETED | Création existante conservée; coordonnées et champs validés; création et trace `ReportHistory` écrites dans une transaction. |
| Report Read | COMPLETED | Liste existante conservée; ajout d'une lecture individuelle authentifiée. |
| Report Update | COMPLETED | Ajout de PATCH; créateur limité aux signalements `PENDING`, ADMIN autorisé; validation et ancienne/nouvelle valeur dans l'historique, en transaction. |
| Report Delete | PARTIAL | DELETE ajouté et protégé (créateur de `PENDING` ou ADMIN), mais refuse les signalements avec historique, commentaires ou soutiens pour préserver les relations et traces. Les créations ajoutent maintenant une entrée d'historique; leur suppression requiert une solution de journalisation compatible avec une suppression. |
| Comment Create/Read | COMPLETED | Routes existantes conservées; création journalisée dans la transaction du commentaire. |
| Comment Update/Delete | COMPLETED | PATCH/DELETE sur la route commentaires, auteur ou ADMIN seulement; validation 1–500 caractères et journalisation transactionnelle. |
| Support Create/Read/Delete | COMPLETED | POST existant conservé; GET retourne le soutien courant et le compte; DELETE retire le soutien du demandeur. L'unicité Prisma contre les doubles soutiens reste appliquée. Événements journalisés dans une transaction. |
| User Create/Read/Update | COMPLETED | Inscription, lecture ADMIN et changement de rôle existants conservés. Le contrôle du dernier ADMIN est aussi vérifié dans la transaction du changement de rôle. |
| User Delete | PARTIAL | DELETE ADMIN ajouté; refuse la suppression de soi-même, du dernier ADMIN ou d'un compte ayant des données métier/historiques liées. Le modèle actuel ne permet pas de conserver un événement d'audit utilisateur autonome. |
| Dashboard | COMPLETED | `/api/reports/stats` fournit depuis Prisma les totaux, les quatre statuts, les comptes par catégorie et les dernières entrées `ReportHistory`; l'accueil affiche ces mesures. Le filtre de catégorie existant est conservé et la catégorie Autre est maintenant affichée. La page des signalements conserve ses filtres texte/statut/catégorie/lieu. |
| Création/modification de rapport auditée | COMPLETED | Enregistrement transactionnel dans `ReportHistory`, avec détails d'action dans `description`. |
| Statut/affectation audités | COMPLETED | Historique transactionnel déjà présent et conservé. |
| Ajout/modification/suppression de commentaires audités | COMPLETED | Métadonnées action/entité/ID et valeurs pertinentes enregistrées dans `description` et liaison `ReportHistory`. |
| Ajout/retrait de soutien audités | COMPLETED | Métadonnées action/entité/ID enregistrées dans `description` via transactions. |
| Suppression de signalement auditée | NOT IMPLEMENTED | `ReportHistory.reportId` est une relation obligatoire et ne peut pas préserver correctement un tombstone de signalement supprimé. L'opération refuse donc les signalements qui ont une activité liée. |
| Modification/suppression utilisateur auditée | NOT IMPLEMENTED | Le schéma existant ne peut pas enregistrer un événement d'entité User indépendant d'un Report. Une table de journal générique serait nécessaire, mais n'a pas été autorisée. |
| Protection des traces d'audit | PARTIAL | Aucune route d'édition/suppression de `ReportHistory` n'existe; les suppressions de signalements/utilisateurs liés aux traces sont refusées. La forme actuelle du schéma ne fournit toutefois pas un journal générique couvrant toutes les entités. |
| Cinq règles métier documentées | COMPLETED | Voir `docs/BUSINESS_RULES.md`. |

## Modifications effectuées

### Fichiers créés

- `app/api/reports/[id]/route.ts`
- `docs/BUSINESS_RULES.md`
- `docs/FUNCTIONAL_CORRECTIONS_REPORT.md`

### Fichiers modifiés

- `app/api/reports/route.ts`
- `app/api/reports/stats/route.ts`
- `app/api/reports/[id]/comments/route.ts`
- `app/api/reports/[id]/support/route.ts`
- `app/api/admin/users/route.ts`
- `app/admin/users/admin-users-client.tsx`
- `app/home-client.tsx`
- `app/reports/[id]/report-details-client.tsx`
- `features/reports/infrastructure/prisma-report-repository.ts`
- `features/auth/infrastructure/prisma-user-repository.ts`
- `features/reports/domain/report.ts`
- `features/reports/application/use-cases/assign-report.ts`

## CRUD ajouté

- Reports : GET individuel, PATCH, DELETE protégé par ownership/role et présence d'activité liée.
- Comments : PATCH et DELETE; GET/POST existants conservés.
- Supports : GET (état individuel et compte) et DELETE; POST existant conservé.
- Users : DELETE réservé ADMIN; GET/PATCH et création par inscription conservés.

## Dashboard

Les statistiques serveur viennent de Prisma et incluent `total`, `pending`, `inProgress`, `resolved`, `rejected`, `byCategory` et `recentActivities`. L'interface garde son apparence générale et affiche les quatre statuts, ajoute la catégorie « Autre » et consomme les dernières activités historisées. Le flux d'activité public n'expose pas les noms d'acteurs ou les anciennes/nouvelles valeurs stockées dans l'historique.

## Limites non corrigées

1. Aucun changement de schéma n'a été autorisé. Les colonnes de `ReportHistory` sont spécifiques aux signalements/statuts; le type d'action, l'entité et son identifiant sont encodés dans `description` pour les actions Report/Comment/Support.
2. Les suppressions de signalements avec historique ou enfants sont refusées pour préserver les données. Un audit complet de suppression nécessiterait un modèle de journal/tombstone adapté.
3. Les changements de rôle et suppressions de comptes ne peuvent pas être conservés comme événements auditables avec le modèle actuel.
4. Les utilisateurs liés à des données métier ne peuvent pas être supprimés; leurs données ne sont ni supprimées ni réaffectées.
5. Aucun test, vérification de type, lint, migration ou appel de base de données n'a été exécuté dans le cadre de cette mission, conformément à la consigne.
