Ajoute un onglet "Vidéos" dans la navigation admin (entre "Talents" et "Upload") :

1. NAVIGATION
- Ajouter "Vidéos" dans la navbar pills, entre Talents et Upload
- Route : /videos

2. PAGE /videos
- Header : "Vidéos" à gauche + compteur total (ex: "23 vidéos") + champ de recherche à droite (recherche par titre de vidéo ou nom de talent, debounce 300ms)
- Filtres sous le header : pills de filtre par talent (Tous, Juana Wein, Naïa Combary, etc.), pill active en bg-white shadow comme la navbar

3. GALERIE
- Grille responsive : 3 colonnes sur desktop, 2 sur tablette, 1 sur mobile
- Chaque card :
  - Thumbnail en 16:9 avec border-radius 8px, hover scale 1.02 + shadow-md
  - Durée en badge en bas à droite du thumbnail (fond noir/70, texte blanc, font-size 10px)
  - Sous le thumbnail : titre de la vidéo en 13px font-weight-600
  - Nom du talent en 11px couleur neutral-400
  - Taille du fichier en 11px couleur neutral-300 (ex: "45.2 Mo")
  - Date d'upload en 11px couleur neutral-300 (format relatif : "il y a 2h")
- Au hover sur la card : afficher des boutons d'action en overlay sur le thumbnail (modifier le titre, remplacer la vidéo, changer le thumbnail, supprimer)
- Au clic sur le thumbnail : ouvrir la vidéo dans un player modal (fond noir/80 backdrop blur, vidéo centrée, bouton fermer en haut à droite)

4. TRI
- Bouton de tri discret à côté de la recherche : "Plus récentes" (défaut) / "Plus anciennes" / "Plus lourdes" / "A-Z"

5. DONNÉES
- Fetch toutes les vidéos avec une jointure sur talents pour récupérer le nom du talent
- Presigned URLs pour les thumbnails
- Pagination ou infinite scroll si > 50 vidéos

AMÉLIORATIONS SUPPLÉMENTAIRES :

6. PLAYER MODAL AMÉLIORÉ
- Dans le modal, afficher sous le player : titre (éditable au clic), nom du talent (lien vers sa page), crédits si renseignés, taille, durée, date d'upload
- Boutons : "Copier le lien R2", "Remplacer", "Changer thumbnail", "Supprimer"
- Flèches gauche/droite (ou touches clavier ← →) pour naviguer entre les vidéos sans fermer le modal
- Touche Echap pour fermer

7. MULTI-SELECT
- Checkbox qui apparait au hover en haut à gauche de chaque thumbnail
- Quand au moins 1 vidéo sélectionnée, afficher une barre d'actions en bas de l'écran (fixed) : "X vidéos sélectionnées" + boutons "Créer un lien avec cette sélection", "Supprimer"
- "Tout sélectionner" / "Tout désélectionner" dans la barre

8. DRAG & DROP VERS LIEN
- Afficher un bouton "Créer un lien rapide" : sélectionne des vidéos → clic → créé un lien de partage directement avec ces vidéos pré-sélectionnées (redirige vers le formulaire de création de lien avec les vidéos déjà cochées)

9. VIDÉOS SANS THUMBNAIL
- Si une vidéo n'a pas de thumbnail, afficher un placeholder gris avec une icône caméra et un bouton "Capturer thumbnail"

10. STATS PAR VIDÉO
- Sous chaque card, petit compteur discret : nombre de fois que cette vidéo apparait dans des liens + nombre total de vues toutes liens confondus