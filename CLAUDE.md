# Sad Vault

Plateforme interne de gestion de reels et vidéos pour talents (réalisateurs, photographes, DOP).
Permet d'uploader, organiser et partager des vidéos via des liens uniques sans authentification client.

Projet porté par Alix pour Sad Pictures / RZRE.

## Stack

- **Framework** : Next.js 14+ (App Router, TypeScript, Tailwind CSS)
- **Base de données** : Supabase (PostgreSQL)
- **Stockage vidéo** : Cloudflare R2 (S3-compatible, zero egress fees)
- **Auth** : Supabase Auth (uniquement côté admin)
- **Déploiement** : Vercel
- **Domaine** : vault.sad-pictures.com (ou reels.sad-pictures.com)

## Architecture

```
src/
  app/
    (admin)/           # Routes admin protégées par auth
      layout.tsx       # Auth guard
      dashboard/       # Vue d'ensemble
      talents/         # CRUD talents
      talents/[id]/    # Détail talent + ses vidéos
      uploads/         # Upload vidéos
      links/           # Gestion des liens de partage
    (public)/
      s/[token]/       # Page de partage publique (pas d'auth)
    api/
      upload/          # Presigned URL generation pour R2
      share/           # Création/validation de liens
    login/             # Page de login admin
  lib/
    supabase.ts        # Client Supabase (server + client)
    r2.ts              # Client S3 pour Cloudflare R2
    utils.ts
  components/
    ui/                # Composants UI réutilisables
    video-player.tsx   # Player vidéo custom
    video-card.tsx
    talent-card.tsx
```

## Base de données (Supabase)

3 tables principales :

- **talents** : id, name, slug, avatar_url, bio, created_at
- **videos** : id, talent_id (FK), title, r2_key, thumbnail_key, duration_seconds, file_size_bytes, created_at
- **share_links** : id, token (unique), title, talent_id (FK, nullable), video_ids (jsonb array), expires_at (nullable), view_count, created_at, created_by

RLS activé : toutes les tables sont read/write uniquement pour les utilisateurs authentifiés, sauf share_links qui est lisible publiquement via le token.

## Stockage R2

- Bucket : `sad-vault`
- Structure des clés : `videos/{talent_slug}/{uuid}.{ext}` et `thumbnails/{talent_slug}/{uuid}.jpg`
- Upload via presigned URL (PUT) généré côté API Next.js
- Lecture via presigned URL (GET) avec expiration courte pour le player

## Fonctionnalités

### MVP (Phase 1)
1. Auth admin (Supabase email/password)
2. CRUD talents (nom, slug, avatar)
3. Upload vidéos (sélection talent, titre, upload direct vers R2)
4. Listing vidéos par talent
5. Création de liens de partage (sélection talent + vidéos, durée d'expiration optionnelle)
6. Page publique de partage : affiche le player pour les vidéos sélectionnées

### Phase 2 (plus tard)
- Player avec watermark overlay
- Disable right-click / download
- Analytics par lien (nombre de vues, durée de visionnage)
- Page portfolio publique par talent
- Envoi du lien par email directement depuis l'app
- Drag-and-drop pour réordonner les vidéos dans un lien

## Variables d'environnement

Voir `.env.example` pour la liste complète.

## Conventions

- Langue du code et des commentaires : anglais
- Langue de l'interface : français
- Pas d'em dash (—) dans les textes
- Style : minimal, sobre, noir et blanc avec accents subtils
- Composants UI : shadcn/ui
- Icônes : lucide-react
- Formulaires : react-hook-form + zod

## Plan de développement

### Étape 1 : Setup
- Init Next.js + Tailwind + shadcn/ui
- Config Supabase client
- Config R2 client (aws-sdk S3)
- Variables d'env
- Layout admin avec sidebar

### Étape 2 : Auth + Talents
- Page login admin
- Middleware auth
- CRUD talents (liste, création, édition, suppression)
- Page détail talent

### Étape 3 : Upload vidéos
- API route pour générer presigned URL (R2)
- Composant d'upload avec progress bar
- Association vidéo au talent
- Listing vidéos sur la page talent
- Génération de thumbnail (si possible côté client, sinon placeholder)

### Étape 4 : Liens de partage
- Interface de création de lien (sélection talent + vidéos)
- Génération de token unique
- API de validation du token
- Page publique /s/[token] avec player

### Étape 5 : Polish + Deploy
- Design propre et responsive
- Gestion d'erreurs
- Loading states
- Deploy Vercel + custom domain
