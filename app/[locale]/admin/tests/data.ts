export interface TestCase {
  id: string;
  title: string;
  steps: string[];
  expected: string;
}
export interface TestModule {
  id: string;
  icon: string;
  title: string;
  tests: TestCase[];
}

// TC-001..TC-099 = modules shared with the twin app — keep them IDENTICAL in both
// apps (generated from one source). TC-101+ = modules specific to this app.
// Never change what an existing ID means: results are stored per ID (qa_test_results).
export const MODULES: TestModule[] = [
  {
    id: "auth", icon: "🔐", title: "Authentification", tests: [
      { id: "TC-001", title: "Connexion avec credentials valides", steps: ["Ouvrir /fr/signin", "Saisir un email + mot de passe corrects", "Cliquer \"Se connecter\""], expected: "Redirection vers /fr/dashboard" },
      { id: "TC-002", title: "Connexion avec mauvais mot de passe", steps: ["Saisir un email valide", "Mot de passe incorrect", "Cliquer \"Se connecter\"", "Recommencer en EN puis en AR"], expected: "Cadre rouge en haut du formulaire : « Email ou mot de passe incorrect. » dans la langue choisie (jamais le message anglais de Supabase) ; pas de redirection" },
      { id: "TC-003", title: "Déconnexion", steps: ["Être connecté", "Cliquer sur Se déconnecter (sidebar)"], expected: "Redirection vers /fr/signin, session détruite ; /fr/dashboard renvoie ensuite vers /fr/signin" },
      { id: "TC-004", title: "Accès dashboard sans session", steps: ["Sans être connecté, ouvrir /fr/dashboard puis /fr/dashboard/settings"], expected: "Redirection automatique vers /fr/signin" },
      { id: "TC-005", title: "Mot de passe oublié", steps: ["Sur /fr/signin, cliquer « Mot de passe oublié »", "Saisir l'email, envoyer", "Ouvrir le mail, cliquer le lien"], expected: "Le lien s'ouvre dans un nouvel onglet sur « Nouveau mot de passe » (pas « activer votre compte ») ; nouveau mot de passe accepté, connexion possible avec" },
      { id: "TC-006", title: "Inscription d'un cabinet + confirmation email", steps: ["Ouvrir /fr/signup, remplir le formulaire", "Avant de confirmer : ouvrir /fr/admin", "Cliquer le lien de confirmation reçu, rouvrir /fr/admin"], expected: "Avant confirmation : le cabinet n'apparaît nulle part dans l'admin (badge Approbations inchangé) et aucun email n'est reçu. Après : l'équipe reçoit l'email « Nouvelle inscription » et le cabinet apparaît dans « En attente » avec Approuver ; le badge Approbations augmente de 1" },
      { id: "TC-007", title: "Inscription avec un email déjà utilisé", steps: ["Sur /fr/signup, saisir l'email d'un compte existant"], expected: "Cadre rouge en haut « Un compte existe déjà avec cette adresse e-mail… » (pas l'écran « vérifiez votre email »)" },
      { id: "TC-008", title: "Afficher / masquer le mot de passe", steps: ["Sur la connexion, l'inscription, la réinitialisation et Paramètres → mot de passe", "Cliquer l'œil dans le champ, puis recliquer"], expected: "Le mot de passe s'affiche en clair puis se masque à nouveau, sur chaque champ mot de passe" },
      { id: "TC-009", title: "Déjà connecté → tableau de bord", steps: ["Être connecté", "Taper denticareapp.com, puis /fr/signin, puis /en/signup, puis /ar"], expected: "Chaque adresse ouvre directement le tableau de bord, dans la langue de l'adresse (fr / en / ar) ; déconnecté, la page d'accueil et la connexion s'affichent normalement" },
      { id: "TC-010", title: "Mot de passe oublié jamais redirigé", steps: ["Être connecté, ouvrir /fr/forgot-password", "Cliquer un lien de réinitialisation reçu par email"], expected: "La page s'affiche (pas de redirection vers le tableau de bord) ; le lien de réinitialisation mène bien au formulaire « Nouveau mot de passe »" },
      { id: "TC-011", title: "Connexion avec un email non confirmé", steps: ["S'inscrire sans cliquer le lien de confirmation", "Tenter de se connecter"], expected: "Cadre rouge traduit : « Votre adresse email n'est pas encore confirmée… » ; pas d'accès" },
      { id: "TC-012", title: "Mot de passe trop court", steps: ["Inscription avec un mot de passe de moins de 8 caractères"], expected: "Message d'erreur traduit, rien n'est créé" },
      { id: "TC-013", title: "Lien de réinitialisation expiré / déjà utilisé", steps: ["Recliquer un ancien lien de réinitialisation"], expected: "Message traduit « Le lien a expiré… », aucune page blanche ni message anglais" },
      { id: "TC-014", title: "Écran « Compte en attente d'approbation »", steps: ["Se connecter avec le propriétaire d'un cabinet non encore approuvé"], expected: "Carte ⏳ « Compte en attente d'approbation », texte « …Vous pourrez vous connecter dès qu'il sera approuvé. », ligne « Des questions ? Contactez amine@denticareapp.com » ; aucun accès au tableau de bord" },
    ],
  },
  {
    id: "approvals", icon: "👥", title: "Approbations & membres", tests: [
      { id: "TC-015", title: "Approuver un cabinet", steps: ["Admin → Approbations → Approuver", "Le propriétaire se reconnecte"], expected: "Cabinet passe dans « Cabinets approuvés » ; le propriétaire accède au tableau de bord" },
      { id: "TC-016", title: "Refuser une inscription", steps: ["Admin → Approbations → « Refuser » sur une inscription en attente, confirmer", "Se réinscrire avec le même email"], expected: "Compte + cabinet supprimés ; l'email est réutilisable" },
      { id: "TC-017", title: "Révoquer un cabinet approuvé", steps: ["Admin → Cabinets approuvés → Révoquer"], expected: "Le propriétaire retombe sur l'écran « Compte en attente d'approbation »" },
      { id: "TC-019", title: "Inviter un membre", steps: ["Propriétaire → Paramètres → « + Ajouter un membre »", "Remplir prénom, nom, email, rôle ; Envoyer l'invitation"], expected: "Formulaire avec libellés au-dessus des champs ; cadre « ✅ Invitation envoyée à … » ; le membre apparaît avec le badge « En attente »" },
      { id: "TC-020", title: "Membre invité : activation du compte", steps: ["Le membre clique le lien d'invitation"], expected: "Formulaire « Activer mon compte » (email / prénom / nom pré-remplis) ; mot de passe défini ; tant qu'il n'a pas activé, il n'apparaît pas côté admin" },
      { id: "TC-021", title: "Approuver un membre", steps: ["Admin → Approbations → Membres en attente → Approuver", "Le membre se connecte"], expected: "Le membre accède au tableau de bord ; avant l'approbation il voyait « Compte en attente d'approbation »" },
      { id: "TC-022", title: "Désactiver un membre (persistance)", steps: ["Propriétaire → Paramètres → Membres → Désactiver, confirmer", "Recharger la page"], expected: "Badge « Désactivé » toujours présent après rechargement ; bouton « Réactiver » affiché" },
      { id: "TC-023", title: "Membre désactivé", steps: ["Se connecter avec le membre désactivé"], expected: "Écran 🔒 « Accès désactivé » avec la ligne de contact ; ses données créées restent visibles pour le propriétaire" },
      { id: "TC-024", title: "Réactiver un membre", steps: ["Propriétaire → Réactiver", "Le membre se reconnecte"], expected: "Accès rétabli" },
      { id: "TC-025", title: "Protection du propriétaire", steps: ["Propriétaire → Paramètres → Membres : regarder sa propre ligne"], expected: "Sur sa propre ligne : ni menu de rôle ni Désactiver (un propriétaire ne peut pas se rétrograder ni se désactiver lui-même)" },
      { id: "TC-026", title: "Membres : droits selon le rôle", steps: ["Ouvrir Paramètres avec un dentiste (non propriétaire)"], expected: "Liste des membres visible mais sans « + Ajouter un membre » ni Désactiver/Réactiver" },
      { id: "TC-027", title: "Erreur de désactivation affichée", steps: ["Couper le réseau (mode avion) puis cliquer Désactiver"], expected: "Cadre rouge « L'opération sur ce membre a échoué » au-dessus de la liste ; rien ne change" },
      { id: "TC-028", title: "Isolation entre cabinets (RLS)", steps: ["Créer un patient dans le cabinet A", "Se connecter à un cabinet B"], expected: "Le patient de A est invisible pour B (listes, recherche, adresse directe → 404)" },
      { id: "TC-064", title: "Changer le rôle d'un membre", steps: ["Propriétaire → Paramètres → Membres → menu de rôle d'un assistant → Dentiste", "Recharger la page", "Se connecter avec ce membre"], expected: "Le nouveau rôle reste après rechargement ; le membre a immédiatement les droits d'un dentiste (et inversement en repassant assistant)" },
      { id: "TC-065", title: "Promouvoir propriétaire / gérer un autre propriétaire", steps: ["Menu de rôle d'un membre approuvé → Propriétaire, confirmer", "Se connecter avec ce nouveau propriétaire, rétrograder ou désactiver l'autre propriétaire", "Essayer de promouvoir un membre encore en attente d'approbation"], expected: "Confirmation demandée avant la promotion ; les deux propriétaires peuvent gérer tout le monde, sauf eux-mêmes ; un membre en attente → cadre rouge « doit d'abord être approuvé »" },
      { id: "TC-066", title: "Email « Nouveau membre à approuver »", steps: ["Propriétaire → inviter un membre avec un email jamais utilisé", "Le membre clique le lien d'invitation", "Cliquer « Approuver ce membre » dans l'email reçu"], expected: "Rien n'est reçu à l'invitation ; un seul email à l'ouverture du lien (nom, email, rôle, cabinet) ; le bouton affiche « Membre approuvé » et le membre accède au tableau de bord" },
    ],
  },
  {
    id: "settings", icon: "⚙️", title: "Paramètres & Mon profil", tests: [
      { id: "TC-029", title: "Infos du cabinet (propriétaire)", steps: ["Modifier nom, adresse, téléphone ; Enregistrer", "Recharger"], expected: "« ✓ Enregistré » en vert ; valeurs conservées et reprises sur les PDF" },
      { id: "TC-030", title: "Logo", steps: ["Charger un logo < 2 Mo, Enregistrer", "Tenter un logo > 2 Mo", "Supprimer le logo"], expected: "Logo affiché (app + PDF) ; > 2 Mo refusé avec un message traduit ; suppression OK" },
      { id: "TC-031", title: "Changer le mot de passe (Mon profil)", steps: ["Cliquer sur son nom en bas de la barre latérale → Mon profil", "Nouveau mot de passe + confirmation différents", "Moins de 8 caractères", "Deux mots de passe identiques valides"], expected: "Erreurs traduites en cadre rouge ; succès « ✓ Mot de passe mis à jour » en vert (jamais en rouge) ; reconnexion OK ; plus de mot de passe dans Paramètres" },
      { id: "TC-032", title: "Changer la langue (Mon profil)", steps: ["Mon profil → Langue → English, puis العربية"], expected: "Toute l'interface bascule ; en arabe la mise en page est RTL ; le choix est conservé à la reconnexion" },
      { id: "TC-033", title: "Assistant : pas de Paramètres", steps: ["Se connecter avec un compte assistant", "Regarder la barre latérale, puis taper /fr/dashboard/settings", "Cliquer sur son nom en bas de la barre latérale"], expected: "Pas de Paramètres dans la barre latérale ; l'adresse directe affiche la page 403 ; Mon profil s'ouvre (nom, email, mot de passe, langue)" },
      { id: "TC-034", title: "Paramètres pour un dentiste non propriétaire", steps: ["Se connecter avec un dentiste", "Ouvrir Paramètres"], expected: "Pas d'infos du cabinet / logo / Enregistrer ; membres (lecture) et catalogue visibles ; pas de mot de passe ni de langue (ils sont dans Mon profil)" },
      { id: "TC-072", title: "Mon profil : prénom et nom", steps: ["Cliquer sur son nom en bas de la barre latérale", "Modifier prénom et nom, Enregistrer", "Vider le prénom, Enregistrer"], expected: "« ✓ Enregistré » en vert ; le nouveau prénom apparaît dans la barre latérale et dans « Créé par » ; prénom vide → cadre rouge « Le prénom est obligatoire »" },
      { id: "TC-073", title: "Mon profil : changer l'email", steps: ["Mon profil → Nouvel email → « Changer l'email »", "Cliquer le lien reçu sur l'ancienne adresse, puis celui reçu sur la nouvelle", "Recliquer un des liens"], expected: "Message « cliquez sur le lien envoyé à … » ; après le 1er lien : « Première confirmation reçue » ; après le 2e : « ✓ Adresse email mise à jour » et nouvel email en bas de la barre latérale ; lien réutilisé → cadre rouge « lien expiré »" },
    ],
  },
  {
    id: "errors", icon: "🧭", title: "Erreurs & navigation", tests: [
      { id: "TC-035", title: "404 dans le tableau de bord", steps: ["Connecté, ouvrir /fr/dashboard/nimportequoi"], expected: "Page « 🔍 Page introuvable » avec la barre latérale et « ← Retour à l'accueil »" },
      { id: "TC-036", title: "404 sur le site (adresse mal tapée)", steps: ["Ouvrir /fr/dashboardp puis /ar/xyz, connecté puis déconnecté"], expected: "Page 404 aux couleurs de l'app (logo, texte traduit) ; code HTTP 404 ; « Retour à l'accueil » → accueil (ou tableau de bord si connecté)" },
      { id: "TC-037", title: "Fiche inexistante", steps: ["Ouvrir la fiche d'un patient avec un identifiant inventé"], expected: "Page « Page introuvable » (pas d'erreur technique)" },
      { id: "TC-038", title: "Cadre d'erreur unique", steps: ["Ouvrir une modale de création, enregistrer sans les champs obligatoires"], expected: "Cadre rouge (fond rouge pâle, bordure rouge) visible au-dessus du bouton, la modale défile jusqu'à l'erreur ; aucun petit texte rouge isolé" },
      { id: "TC-039", title: "Messages de succès et infos jamais en rouge", steps: ["Enregistrer les paramètres, changer le mot de passe, envoyer une invitation", "Ouvrir une fiche avec adresse/téléphone"], expected: "Succès en vert / bleu-teal ; adresse, téléphone et infos en texte normal (jamais dans un cadre rouge)" },
      { id: "TC-040", title: "Créé par / Modifié par", steps: ["Créer un patient avec un membre A, le modifier avec un membre B", "Ouvrir sa fiche (et les fiches des autres modules)"], expected: "Pied de la carte : « Créé par A · date » et « Modifié par B · date » ; sur une fiche jamais modifiée seul « Créé par » apparaît" },
      { id: "TC-041", title: "Recherche globale", steps: ["Taper un nom de patient, de produit / acte, un numéro de document", "Cliquer un résultat"], expected: "Résultats groupés par type ; clic = page de détail ; patients archivés marqués « Archivé »" },
      { id: "TC-042", title: "Détail = page, création = modale", steps: ["Cliquer une ligne dans chaque liste", "Cliquer « + Nouveau … »"], expected: "Une ligne ouvre une page de détail (← Retour) ; la création / édition s'ouvre en modale" },
    ],
  },
  {
    id: "support", icon: "🛟", title: "Support", tests: [
      { id: "TC-043", title: "Ouvrir un ticket", steps: ["Tableau de bord → Support → nouveau ticket avec une pièce jointe"], expected: "Ticket « Ouvert » ; l'équipe (amine + yasmine) reçoit l'email avec la pièce jointe" },
      { id: "TC-044", title: "Limites des pièces jointes", steps: ["Joindre plus de 5 fichiers ou plus de 15 Mo"], expected: "Refus avec un message traduit, rien n'est envoyé" },
      { id: "TC-045", title: "Réponse admin", steps: ["Admin → Support → répondre"], expected: "Statut « Répondu » ; le demandeur reçoit l'email ; la réponse apparaît dans son fil" },
      { id: "TC-046", title: "Réponse de l'utilisateur / réouverture", steps: ["L'utilisateur répond à un ticket répondu ou fermé"], expected: "Le ticket repasse « Ouvert » ; l'équipe reçoit l'email" },
      { id: "TC-047", title: "Fermer un ticket", steps: ["Utilisateur ou admin ferme le ticket"], expected: "Statut « Fermé », filtre admin « Fermés » le montre" },
      { id: "TC-048", title: "Formulaire de contact public", steps: ["Déconnecté, ouvrir /fr/contact, envoyer un message"], expected: "Email reçu par l'équipe avec « Répondre à » = l'expéditeur ; message de confirmation affiché" },
      { id: "TC-049", title: "Support pour tous les rôles", steps: ["Ouvrir Support avec un assistant"], expected: "Onglet Support visible et utilisable" },
    ],
  },
  {
    id: "admin", icon: "🛡️", title: "Panneau admin", tests: [
      { id: "TC-050", title: "Accès réservé aux admins", steps: ["Se connecter avec un compte non-admin, ouvrir /fr/admin et /fr/admin/tests"], expected: "Redirection /signin ; seuls les emails admin accèdent" },
      { id: "TC-051", title: "Barre latérale admin", steps: ["Ouvrir /fr/admin"], expected: "Approbations · Support · Tests · Documentation · Infrastructure ; nom de l'admin connecté en bas ; badges approbations et tickets ouverts" },
      { id: "TC-052", title: "Recette partagée", steps: ["Cocher un cas ✓ / ✕ / ◦", "Recharger, puis se connecter avec l'autre admin"], expected: "Le résultat est conservé, partagé entre admins et tagué au nom de l'admin ; recliquer le même bouton l'efface" },
      { id: "TC-053", title: "Documentation et Infrastructure", steps: ["Ouvrir les deux pages en clair puis en sombre"], expected: "Contenu lisible dans les deux thèmes, tableaux défilables sur mobile" },
      { id: "TC-054", title: "Admin sans cabinet", steps: ["Se connecter avec un email admin puis ouvrir /fr/dashboard"], expected: "Redirection vers /fr/admin" },
    ],
  },
  {
    id: "ui", icon: "🌐", title: "Langues, interface & mobile", tests: [
      { id: "TC-055", title: "Traductions complètes", steps: ["Parcourir chaque page en FR, EN, AR"], expected: "Aucune clé brute (ex. « settings.role ») ni texte resté en français en EN/AR ; arabe en RTL" },
      { id: "TC-056", title: "Langue par défaut", steps: ["Ouvrir denticareapp.com/dashboard sans langue"], expected: "Redirection vers la dernière langue choisie, sinon celle du navigateur, sinon /fr/" },
      { id: "TC-057", title: "Mode clair par défaut", steps: ["Mettre l'ordinateur en thème sombre", "Ouvrir le site dans une fenêtre privée", "Basculer en sombre avec le bouton, recharger"], expected: "Le site s'ouvre en clair malgré le réglage de l'ordinateur ; le sombre n'apparaît que s'il a été choisi et reste au rechargement" },
      { id: "TC-058", title: "Mobile — page d'accueil", steps: ["Ouvrir l'accueil sur un téléphone, faire défiler", "Ouvrir le menu ☰"], expected: "Les images de fond ne sautent pas ; logo seul avec ☰ en haut ; les langues sont dans le menu ☰ (aucun chevauchement)" },
      { id: "TC-059", title: "Mobile — pages de connexion / inscription / contact", steps: ["Ouvrir ces pages sur un téléphone"], expected: "Logo et langues côte à côte sans chevauchement ; lien « Se connecter » sur une ligne" },
      { id: "TC-060", title: "Mobile — tableau de bord et modales", steps: ["Sur téléphone : ouvrir des listes, « Nouvelle commande / visite », un assistant de génération"], expected: "Menu en tiroir ; tableaux défilables ; aucune modale ne dépasse à droite ; pas de défilement horizontal de la page" },
      { id: "TC-061", title: "Clavier dans les modales", steps: ["Ouvrir une modale de création", "Entrée pour valider, Échap pour fermer"], expected: "Entrée enregistre, Échap ferme sans rien créer" },
      { id: "TC-062", title: "Favicon lisible", steps: ["Ouvrir le site dans Chrome, Firefox (fenêtre privée) et Safari / iPhone (ajouter à l'écran d'accueil)"], expected: "Onglet : tuile teal avec le dent blanc, lisible ; icône d'écran d'accueil = logo sur fond blanc" },
      { id: "TC-063", title: "Heures en heure locale", steps: ["Créer un RDV à 10:00, l'afficher dans la liste, le détail (et l'agenda)"], expected: "10:00 partout, sans décalage ni avertissement d'hydratation" },
    ],
  },
  {
    id: "documents", icon: "🗂️", title: "Documents", tests: [
      { id: "TC-067", title: "Liste des documents", steps: ["Barre latérale → 🗂️ Documents"], expected: "Tous les PDF générables (factures, devis, ordonnances, fiches patient) avec type, patient, référence, date et « Créé par » ; les éléments annulés n'y sont pas" },
      { id: "TC-068", title: "Filtres", steps: ["Filtrer par type, par période (Du / Au), par « Créé par », puis taper un nom de patient", "Cliquer « Réinitialiser »"], expected: "La liste et le compteur suivent chaque filtre ; « Réinitialiser » remet tout" },
      { id: "TC-069", title: "Télécharger un document", steps: ["Cliquer « 📄 Télécharger » sur une ligne"], expected: "Le PDF téléchargé est identique à celui du bouton de la page de détail" },
      { id: "TC-070", title: "Télécharger une sélection en ZIP", steps: ["Cocher plusieurs lignes (ou « Tout sélectionner » après un filtre)", "Cliquer « Télécharger la sélection (n) en ZIP »"], expected: "Progression « Génération x/n… » puis un fichier documents-AAAA-MM-JJ.zip contenant un PDF par ligne cochée" },
      { id: "TC-071", title: "Pied de page des PDF", steps: ["Télécharger n'importe quel PDF (facture, ordonnance…)", "Regarder le bas de la page"], expected: "Vrai logo de l'application (pas d'emoji) puis « Généré par DentiCareApp · référence · date », le nom en gras avec « Care » en turquoise ; lisible aussi imprimé" },
    ],
  },
  {
    id: "subscriptions", icon: "💳", title: "Abonnements", tests: [
      { id: "TC-074", title: "Essai de 3 mois à l'inscription", steps: ["Inscrire un cabinet (email confirmé, approuvé)", "Admin → 💳 Abonnements"], expected: "L'abonnement apparaît « Essai » avec une fin d'essai = date d'inscription + 3 mois ; aucune facture" },
      { id: "TC-075", title: "Onglet Abonnement (propriétaire)", steps: ["Propriétaire → Paramètres", "Se connecter en non-propriétaire, ouvrir Paramètres"], expected: "Propriétaire : « Formule Standard · 199,00 MAD / mois », « Période d'essai gratuite jusqu'au … », solde, factures ; non-propriétaire : pas de section Abonnement" },
      { id: "TC-076", title: "Génération des factures du mois", steps: ["Admin → Abonnements → « Générer les factures du mois » (après la fin d'un essai)", "Recliquer"], expected: "Une facture FA-DEN-AAAA-NNNN par cabinet approuvé(e) dont l'essai est fini ; un 2e clic ne crée rien (une seule facture par mois) ; automatique aussi le 1er de chaque mois à 01:00 UTC" },
      { id: "TC-077", title: "Paiement, solde et crédit", steps: ["Détail d'un abonnement → Enregistrer un paiement supérieur au dû", "Générer la facture du mois suivant"], expected: "Solde affiché « Crédit … » ; la facture suivante reprend le solde précédent négatif et affiche « Crédit en votre faveur » si le crédit dépasse la mensualité ; impayé → solde précédent positif ajouté au total" },
      { id: "TC-078", title: "Facture PDF d'abonnement", steps: ["Télécharger une facture depuis l'admin, puis depuis Paramètres → Abonnement"], expected: "Même PDF : émetteur MediCareApp (mentions « provisoires »), facturé à la cabinet, période, mensualité, solde précédent, total à payer ou crédit, RIB, pied avec logo" },
      { id: "TC-079", title: "Résilier / réactiver", steps: ["Détail d'un abonnement → Résilier", "Générer les factures du mois", "Réactiver"], expected: "Statut « Résilié », plus aucune facture générée ; réactivé → reprend « Actif » (ou « Essai » si l'essai court encore)" },
    ],
  },
  {
    id: "deletion", icon: "🗑️", title: "Suppression & archives", tests: [
      { id: "TC-080", title: "Supprimer définitivement", steps: ["Admin → Approbations → « Supprimer… » sur « sdfsdf » (cabinet vide)", "Taper le nom exact, cliquer « Supprimer définitivement »"], expected: "Bandeau vert « … a été archivé puis supprimé définitivement » ; le cabinet n'apparaît plus ni dans Approbations ni dans Abonnements ; les autres établissements sont intacts" },
      { id: "TC-081", title: "Archive avant suppression", steps: ["Après TC-080 : Admin → 🗄️ Archives", "« 🗜️ Télécharger (ZIP) », ouvrir le ZIP"], expected: "L'archive apparaît (nom, date, « par » ton email, résumé) ; le ZIP contient index.json, data.json (toutes les lignes + comptes des membres) et files/ (logo, photos, pièces jointes s'il y en avait)" },
      { id: "TC-082", title: "Confirmation par le nom", steps: ["Ouvrir la zone dangereuse d'un établissement", "Taper un nom faux, puis avec une faute de majuscule, puis le nom exact"], expected: "Bouton grisé tant que le nom n'est pas exactement identique ; il s'active seulement avec le nom exact (un établissement sans nom se confirme avec SUPPRIMER)" },
      { id: "TC-083", title: "Résumé avant suppression", steps: ["Zone dangereuse d'un établissement avec des données (sans supprimer)", "Comparer avec ses listes (Patients…)"], expected: "Le résumé affiche le nombre de membres, patients, visites, dossiers, factures, ordonnances, RDV, actes ; les chiffres correspondent à ce que voit l'établissement" },
      { id: "TC-084", title: "Email réutilisable après suppression", steps: ["Après TC-080 : s'inscrire avec l'email du propriétaire supprimé"], expected: "L'inscription fonctionne (pas « Un compte existe déjà ») ; nouvelle cabinet vierge, en attente d'approbation" },
      { id: "TC-085", title: "Archives réservées à l'admin", steps: ["Connecté avec un compte non-admin, ouvrir /fr/admin/archives", "Réutiliser un lien de téléchargement d'archive 10 minutes plus tard"], expected: "Non-admin : renvoyé vers la connexion / refusé ; le lien de téléchargement expire (lien signé 10 min), l'espace « archives » n'est jamais public" },
    ],
  },
  {
    id: "home", icon: "🏠", title: "Tableau de bord & rôles", tests: [
      { id: "TC-101", title: "Accueil", steps: ["Ouvrir /fr/dashboard en propriétaire puis en assistant"], expected: "Propriétaire/dentiste : KPIs, factures récentes, raccourcis cliniques ; assistant : pas de chiffres ni raccourcis cliniques" },
      { id: "TC-102", title: "Navigation d'un assistant", steps: ["Se connecter en assistant"], expected: "Barre latérale : Patients, Dossiers, Rendez-vous, Support uniquement (l'agenda est dans Rendez-vous, le profil via son nom en bas)" },
      { id: "TC-103", title: "403 pour un assistant", steps: ["En assistant, taper /fr/dashboard/consultations (puis /factures, /actes)"], expected: "Page « 🚫 Accès non autorisé » avec la barre latérale et « ← Retour à l'accueil » (plus de redirection silencieuse vers Patients)" },
      { id: "TC-104", title: "Écritures bloquées en base (assistant)", steps: ["En assistant, tenter une action de facturation ou de visite"], expected: "Refus ; création / édition patients, dossiers et RDV autorisées" },
    ],
  },
  {
    id: "patients", icon: "👤", title: "Patients", tests: [
      { id: "TC-105", title: "Créer un patient", steps: ["Nouveau patient : prénom, nom, téléphone, naissance, CIN, sexe, mutuelle"], expected: "Patient créé, visible dans la liste et la recherche" },
      { id: "TC-106", title: "Fiche patient", steps: ["Ouvrir un patient"], expected: "Contact, vue rapide (dernière visite avec son titre, prochain RDV, factures actives), actions, historique, schéma dentaire ; Créé par / Modifié par" },
      { id: "TC-107", title: "Modifier / archiver / désarchiver", steps: ["Modifier le téléphone ; archiver un patient avec visites, factures, RDV ; désarchiver"], expected: "Enregistré ; archivage en cascade avec badge ; désarchiver restaure (masqué pour un assistant)" },
      { id: "TC-108", title: "Fiche patient imprimable", steps: ["« 🖨️ Imprimer infos »"], expected: "PDF avec logo, infos, schéma dentaire (soins prévus en pointillés) et QR « Mon espace patient »" },
      { id: "TC-109", title: "WhatsApp / appel", steps: ["Cliquer WhatsApp ou Appeler"], expected: "Ouvre WhatsApp (numéro normalisé) ou le composeur" },
    ],
  },
  {
    id: "odontogram", icon: "🦷", title: "Schéma dentaire", tests: [
      { id: "TC-110", title: "Adulte / enfant", steps: ["Ouvrir un patient ≥ 13 ans puis < 13 ans"], expected: "Dents permanentes 11–48 ; dents temporaires 51–85" },
      { id: "TC-111", title: "Statut + note d'une dent", steps: ["Cliquer une dent, choisir un statut, ajouter une note, recharger", "Effacer le statut"], expected: "Statut et note conservés ; effacement OK" },
      { id: "TC-112", title: "Mise à jour par la facturation", steps: ["Facturer un acte « par dent » (ex. obturation) sur la dent 16"], expected: "La dent 16 passe au statut de l'acte" },
      { id: "TC-113", title: "Prévoir un soin", steps: ["Dent → Soins prévus → choisir un acte + note → Prévoir"], expected: "Dent en pointillés orange ; soin listé dans « Plan de traitement »" },
      { id: "TC-114", title: "Soin prévu réalisé par la facturation", steps: ["Prévoir « Obturation » sur la 26, puis facturer l'acte Obturation sur la 26"], expected: "Soin « Réalisé le … », pointillés disparus, dent Obturée" },
      { id: "TC-115", title: "Soin réalisé / annulé à la main", steps: ["Cliquer ✓ Réalisé sur un soin, ✕ sur un autre"], expected: "Réalisé : la dent prend le statut de l'acte ; annulé : barré, plus de pointillés" },
      { id: "TC-116", title: "Historique d'une dent", steps: ["Changer une dent à la main puis via un acte facturé ; rouvrir la dent"], expected: "Historique daté : ancien → nouveau statut, « via <acte> », auteur" },
      { id: "TC-117", title: "Lecture seule pour un assistant", steps: ["Ouvrir un patient en assistant"], expected: "Schéma, soins prévus et historique visibles, rien de modifiable" },
    ],
  },
  {
    id: "dossiers", icon: "📁", title: "Dossiers & acomptes", tests: [
      { id: "TC-118", title: "Créer un dossier + hub", steps: ["Nouveau dossier, l'ouvrir"], expected: "Hub : documents, acomptes, visites (titres), RDV, ordonnances, reste à payer" },
      { id: "TC-119", title: "Acomptes", steps: ["Ajouter un acompte (montant, moyen, date)"], expected: "Reste à payer = factures non annulées − acomptes" },
      { id: "TC-120", title: "Visite depuis le dossier", steps: ["+ Visite sans titre, puis avec titre et facturation"], expected: "Sans titre : erreur ; avec : visite créée, actes ajoutés à la facture ouverte" },
      { id: "TC-121", title: "Statut clinique", steps: ["Passer un dossier à Terminé"], expected: "Statut mis à jour, indépendant du paiement" },
      { id: "TC-122", title: "Dossier en assistant", steps: ["Ouvrir un dossier en assistant"], expected: "Infos + RDV seulement" },
    ],
  },
  {
    id: "visites", icon: "🏥", title: "Visites", tests: [
      { id: "TC-123", title: "Titre obligatoire", steps: ["Nouvelle visite sans titre"], expected: "Erreur « Le titre de la visite est obligatoire », rien créé" },
      { id: "TC-124", title: "Visite facturée sans dossier", steps: ["Titre, patient, date, « Facturer » + actes"], expected: "Visite créée, dossier « Visite du <date> » créé, facture avec les actes" },
      { id: "TC-125", title: "Date future refusée", steps: ["Date de visite dans le futur"], expected: "Erreur : une visite future est un RDV" },
      { id: "TC-126", title: "Liste, recherche, détail", steps: ["Rechercher par titre / patient, ouvrir une visite, « + Ajouter » un acte"], expected: "Colonne Titre ; en-tête « Visite — <titre> » ; actes réalisés (dents) ; pas de double facturation" },
      { id: "TC-127", title: "Modifier une visite", steps: ["Vider le titre puis le remettre"], expected: "Refus sans titre ; titre modifié affiché" },
    ],
  },
  {
    id: "catalog", icon: "📦", title: "Actes & traitements", tests: [
      { id: "TC-128", title: "Acte", steps: ["Créer un acte (nom, catégorie, prix, code)"], expected: "Disponible dans la facturation" },
      { id: "TC-129", title: "Acte « par dent »", steps: ["Portée = dent + « Résultat sur la dent », le facturer"], expected: "Sélecteur de dents ; quantité = nb de dents ; dents imprimées" },
      { id: "TC-130", title: "Traitement (package)", steps: ["Créer un package de plusieurs actes"], expected: "Prix = somme ou prix forcé ; détail avec actes cliquables" },
    ],
  },
  {
    id: "factures", icon: "🧾", title: "Factures, devis & feuilles de soins", tests: [
      { id: "TC-131", title: "Devis", steps: ["Créer un devis"], expected: "PDF « DEVIS DENTAIRE » ; exclu du CA" },
      { id: "TC-132", title: "Facture en attente modifiable", steps: ["Modifier les lignes"], expected: "Lignes et total à jour" },
      { id: "TC-133", title: "Annuler / réactiver", steps: ["Annuler puis réactiver une facture"], expected: "Jamais supprimée ; annulée exclue des totaux" },
      { id: "TC-134", title: "PDF facture", steps: ["Télécharger"], expected: "Logo, lignes (dents), acomptes, QR espace patient, pied avec le logo et « Généré par DentiCareApp » (« Care » en turquoise)" },
      { id: "TC-135", title: "Feuille de soins CNOPS / CNSS", steps: ["Hub dossier → FDS CNOPS puis FDS CNSS"], expected: "Vrai formulaire rempli (assuré, CIN, sexe, naissance, montant, INPE)" },
    ],
  },
  {
    id: "ordonnances", icon: "💊", title: "Ordonnances & médicaments", tests: [
      { id: "TC-136", title: "Créer une ordonnance", steps: ["Patient, visite liée, lignes"], expected: "Visite proposée « date — titre »" },
      { id: "TC-137", title: "Catalogue et médicament libre", steps: ["Ligne depuis le catalogue ; médicament absent du catalogue"], expected: "Défauts pré-remplis ; nouveau médicament ajouté au catalogue sans doublon" },
      { id: "TC-138", title: "PDF + annulation", steps: ["Imprimer, annuler"], expected: "PDF avec QR ; annulée conservée" },
    ],
  },
  {
    id: "rdv", icon: "📅", title: "Rendez-vous & agenda", tests: [
      { id: "TC-139", title: "Nouveau RDV avec créneau", steps: ["Choisir un dentiste, sélectionner un créneau (début + fin)"], expected: "Date + durée réglées ; occupés visibles ; alerte de chevauchement" },
      { id: "TC-140", title: "Contact rapide", steps: ["+ Contact rapide, puis « Créer la fiche patient »"], expected: "RDV sans patient ; fiche créée depuis le contact" },
      { id: "TC-141", title: "Statuts selon la date et le rôle", steps: ["RDV futur puis passé, en dentiste puis en assistant"], expected: "Futur : Planifié/Annulé ; passé : Terminé/Absent (dentiste) ou Annulé/Absent (assistant)" },
      { id: "TC-142", title: "Terminer → visite", steps: ["RDV passé → Terminé → nouvelle visite"], expected: "Titre pré-rempli avec celui du RDV, refus si vide ; visite liée au RDV" },
      { id: "TC-143", title: "Lier une visite existante", steps: ["Terminer → « visite existante »"], expected: "Liste « date — titre »" },
      { id: "TC-144", title: "Agenda", steps: ["Rendez-vous → sélecteur « 📅 Agenda » en haut de la page", "Filtre praticien, clic sur un créneau vide", "Revenir avec « 📋 Liste »"], expected: "Pas d'Agenda dans la barre latérale (Rendez-vous reste surligné) ; couleurs par dentiste ; clic vide → nouveau RDV pré-rempli à ce créneau" },
    ],
  },
  {
    id: "praticiens", icon: "🩺", title: "Praticiens & fournisseurs", tests: [
      { id: "TC-145", title: "Praticiens + INPE", steps: ["Paramètres → Gérer les praticiens ; puis Mon profil → « Votre profil praticien » pour lier son compte"], expected: "Praticien proposé partout ; l'agenda s'ouvre sur son praticien" },
      { id: "TC-146", title: "Fournisseurs", steps: ["Créer un fournisseur et une commande fournisseur"], expected: "Créés ; détail avec Créé par / Modifié par" },
    ],
  },
  {
    id: "portal", icon: "🔗", title: "Pages publiques", tests: [
      { id: "TC-147", title: "Espace patient (QR)", steps: ["Scanner le QR d'une facture, saisir la date de naissance"], expected: "Infos, schéma (soins prévus en pointillés), visites (titres), documents" },
      { id: "TC-148", title: "Mauvaise date de naissance", steps: ["Saisir une date erronée"], expected: "Accès refusé, aucune donnée" },
      { id: "TC-149", title: "Suivi de RDV (/track)", steps: ["Ouvrir le lien de suivi d'un RDV"], expected: "Statut + nom et adresse du cabinet en texte normal (pas de cadre rouge)" },
    ],
  },
  {
    id: "reports", icon: "📊", title: "Rapports", tests: [
      { id: "TC-150", title: "Rapports", steps: ["Ouvrir Rapports"], expected: "KPIs et CA ; devis et factures annulées exclus" },
    ],
  },
];
