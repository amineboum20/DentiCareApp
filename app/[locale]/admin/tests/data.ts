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

export const MODULES: TestModule[] = [
  {
    id: "auth", icon: "🔐", title: "Authentification", tests: [
      { id: "TC-001", title: "Connexion avec credentials valides", steps: ["Ouvrir /fr/signin", "Saisir un email + mot de passe corrects", 'Cliquer "Se connecter"'], expected: "Redirection vers /fr/dashboard" },
      { id: "TC-002", title: "Connexion avec mauvais mot de passe", steps: ["Saisir un email valide", "Mot de passe incorrect", 'Cliquer "Se connecter"', "Recommencer en EN puis en AR"], expected: "Cadre rouge en haut : « Email ou mot de passe incorrect. » dans la langue choisie (jamais le message anglais de Supabase) ; pas de redirection" },
      { id: "TC-003", title: "Déconnexion", steps: ["Être connecté", "Cliquer sur Se déconnecter (sidebar)"], expected: "Redirection vers /fr/signin, session détruite" },
      { id: "TC-004", title: "Accès dashboard sans session", steps: ["Sans être connecté, ouvrir /fr/dashboard"], expected: "Redirection automatique vers /fr/signin" },
      { id: "TC-005", title: "Mot de passe oublié", steps: ["Sur /fr/signin, cliquer « Mot de passe oublié »", "Saisir l'email, envoyer", "Ouvrir le mail, cliquer le lien"], expected: "Le lien s'ouvre dans un nouvel onglet sur « Nouveau mot de passe » (pas « activer votre compte ») ; nouveau mot de passe accepté" },
      { id: "TC-006", title: "Inscription d'un cabinet + confirmation email", steps: ["Ouvrir /fr/signup, remplir le formulaire", "Avant de confirmer : ouvrir /fr/admin", "Cliquer le lien de confirmation reçu, rouvrir /fr/admin"], expected: "Avant confirmation : rien dans « En attente » (seulement la section repliée « En attente de confirmation de l'email », sans bouton Approuver). Après : l'équipe reçoit l'email « Nouvelle inscription » et le cabinet apparaît dans « En attente » avec Approuver ; le propriétaire voit l'écran d'attente jusqu'à l'approbation" },
      { id: "TC-007", title: "Inscription avec un email déjà utilisé", steps: ["Sur /fr/signup, saisir l'email d'un compte existant"], expected: "Cadre rouge en haut « Un compte existe déjà avec cette adresse e-mail… » (pas l'écran « vérifiez votre email »)" },
      { id: "TC-075", title: "Afficher / masquer le mot de passe", steps: ["Sur la connexion, l'inscription, la réinitialisation et Paramètres → mot de passe", "Cliquer l'œil dans le champ, puis recliquer"], expected: "Le mot de passe s'affiche en clair puis se masque à nouveau, sur chaque champ mot de passe" },
    ],
  },
  {
    id: "members", icon: "👥", title: "Membres & rôles", tests: [
      { id: "TC-008", title: "Inviter un membre", steps: ["Paramètres → inviter un membre (email + rôle dentiste/assistant)", "Le membre reçoit l'email d'invitation"], expected: "Membre créé en attente d'approbation admin" },
      { id: "TC-009", title: "Activation du compte invité", steps: ["Admin approuve le membre dans /fr/admin", "Le membre clique le lien d'invitation"], expected: "Formulaire « Activer mon compte » (email/prénom/nom pré-remplis) ; accès au dashboard après mot de passe" },
      { id: "TC-010", title: "Rôle assistant — navigation limitée", steps: ["Se connecter avec un compte assistant"], expected: "Sidebar limitée à Patients, Dossiers, Rendez-vous, Agenda, Support ; une URL interdite (ex. /fr/dashboard/factures) redirige vers Patients" },
      { id: "TC-011", title: "Rôle assistant — écritures bloquées en base", steps: ["En assistant, tenter une action de facturation ou de visite (via l'UI ou l'API)"], expected: "Refus (RLS restrictive) ; création/édition patients, dossiers et RDV autorisées" },
      { id: "TC-012", title: "Désactivation d'un membre", steps: ["Paramètres → désactiver un membre", "Le membre tente de se connecter"], expected: "Écran « Accès désactivé » ; ses données créées sont conservées ; Réactiver rétablit l'accès" },
      { id: "TC-013", title: "Isolation entre cabinets (RLS)", steps: ["Créer un patient dans le cabinet A", "Se connecter à un cabinet B"], expected: "Le patient du cabinet A est invisible pour B" },
      { id: "TC-014", title: "Créé par / Modifié par", steps: ["Créer puis modifier un patient avec deux membres différents", "Ouvrir la fiche"], expected: "Pied de carte « Créé par X · date » et « Modifié par Y · date »" },
    ],
  },
  {
    id: "patients", icon: "👤", title: "Patients", tests: [
      { id: "TC-015", title: "Création d'un patient", steps: ['Cliquer "Nouveau patient"', "Remplir prénom, nom, téléphone, date de naissance, CIN, sexe, mutuelle", "Soumettre"], expected: "Patient créé, visible dans la liste et la recherche globale" },
      { id: "TC-016", title: "Fiche patient", steps: ["Ouvrir un patient"], expected: "Contact, vue rapide (dernière visite avec son titre, prochain RDV, factures actives), actions rapides, historique, schéma dentaire" },
      { id: "TC-017", title: "Édition d'un patient", steps: ["Modifier le téléphone", "Sauvegarder"], expected: "Modification enregistrée et affichée" },
      { id: "TC-018", title: "Archivage + cascade", steps: ["Archiver un patient ayant visites, factures et RDV"], expected: "Le patient et ses données liées disparaissent des listes ; badge « Archivé » ; Désarchiver restaure" },
      { id: "TC-019", title: "Fiche patient imprimable", steps: ["Fiche patient → « 🖨️ Imprimer infos »"], expected: "PDF avec logo du cabinet, infos patient, schéma dentaire et QR « Mon espace patient »" },
      { id: "TC-020", title: "WhatsApp / appel", steps: ["Cliquer WhatsApp ou Appeler sur la fiche"], expected: "Ouvre WhatsApp (numéro normalisé) ou le composeur" },
    ],
  },
  {
    id: "odontogram", icon: "🦷", title: "Schéma dentaire", tests: [
      { id: "TC-021", title: "Schéma adulte", steps: ["Ouvrir un patient de 13 ans ou plus"], expected: "Dents permanentes 11–48 (FDI)" },
      { id: "TC-022", title: "Schéma enfant", steps: ["Ouvrir un patient de moins de 13 ans"], expected: "Dents temporaires 51–85" },
      { id: "TC-023", title: "Statut d'une dent", steps: ["Cliquer une dent, choisir un statut (carie, obturée…) + note", "Recharger la page"], expected: "Statut et note conservés, couleur appliquée" },
      { id: "TC-024", title: "Mise à jour par facturation", steps: ["Facturer un acte « par dent » (ex. obturation) sur la dent 16"], expected: "La dent 16 passe au statut de l'acte (obturée) sur le schéma" },
      { id: "TC-025", title: "Schéma en lecture seule (assistant)", steps: ["Ouvrir une fiche patient en assistant"], expected: "Le schéma, les soins prévus et l'historique s'affichent mais rien n'est modifiable" },
      { id: "TC-071", title: "Prévoir un soin sur une dent", steps: ["Cliquer une dent → Soins prévus → choisir un acte + note → Prévoir"], expected: "La dent apparaît en pointillés orange ; le soin figure dans « Plan de traitement »" },
      { id: "TC-072", title: "Soin prévu réalisé par la facturation", steps: ["Prévoir « Obturation » sur la dent 26", "Facturer l'acte Obturation sur la dent 26 (visite ou dossier)"], expected: "Le soin passe à « Réalisé le … », les pointillés disparaissent, la dent devient Obturée" },
      { id: "TC-073", title: "Historique d'une dent", steps: ["Changer le statut d'une dent à la main, puis via un acte facturé", "Rouvrir la dent"], expected: "Historique daté : ancien → nouveau statut, « via <acte> » pour la facturation, auteur de chaque changement" },
      { id: "TC-074", title: "Soin prévu sur la fiche imprimée et l'espace patient", steps: ["Imprimer la fiche patient", "Ouvrir l'espace patient (QR)"], expected: "Les dents avec un soin prévu sont en pointillés sur les deux" },
    ],
  },
  {
    id: "dossiers", icon: "📁", title: "Dossiers & acomptes", tests: [
      { id: "TC-026", title: "Création d'un dossier", steps: ["Dossiers → nouveau dossier pour un patient"], expected: "Dossier ouvert, visible dans le hub et la fiche patient" },
      { id: "TC-027", title: "Hub du dossier", steps: ["Ouvrir un dossier"], expected: "Documents (devis/factures), acomptes, visites (avec titre), RDV, ordonnances, reste à payer" },
      { id: "TC-028", title: "Ajout d'un acompte", steps: ["Hub dossier → ajouter un acompte (montant, moyen, date)"], expected: "Acompte listé ; reste à payer = total factures non annulées − acomptes" },
      { id: "TC-029", title: "Ajouter une visite depuis le dossier", steps: ["Hub dossier → + Visite", "Laisser le titre vide, enregistrer", "Saisir un titre, enregistrer avec facturation"], expected: "Sans titre : erreur « titre obligatoire » ; avec titre : visite créée et actes ajoutés à la facture ouverte" },
      { id: "TC-030", title: "Statut clinique", steps: ["Passer un dossier à Terminé"], expected: "Statut mis à jour ; indépendant du statut de paiement" },
      { id: "TC-031", title: "Dossier en assistant", steps: ["Ouvrir un dossier en assistant"], expected: "Infos + RDV seulement (pas de facturation, visites ni ordonnances)" },
    ],
  },
  {
    id: "visites", icon: "🏥", title: "Visites", tests: [
      { id: "TC-032", title: "Nouvelle visite — titre obligatoire", steps: ["Visites → + Nouvelle visite", "Remplir patient + date sans titre, enregistrer"], expected: "Erreur « Le titre de la visite est obligatoire » ; rien n'est créé" },
      { id: "TC-033", title: "Nouvelle visite facturée sans dossier", steps: ["Saisir titre, patient, date", "Cocher « Facturer », choisir des actes, enregistrer"], expected: "Visite créée, dossier « Visite du <date> » créé automatiquement, facture avec les actes" },
      { id: "TC-034", title: "Date future refusée", steps: ["Saisir une date de visite dans le futur"], expected: "Erreur : une visite future est un RDV" },
      { id: "TC-035", title: "Liste & recherche", steps: ["Ouvrir /fr/dashboard/consultations", "Rechercher par titre puis par nom de patient"], expected: "Colonne Titre en premier ; la recherche trouve par titre et par nom" },
      { id: "TC-036", title: "Détail + actes réalisés", steps: ["Ouvrir une visite", "+ Ajouter un acte"], expected: "En-tête « Visite — <titre> », actes réalisés listés (avec dents), nouvel acte ajouté sans double facturation" },
      { id: "TC-037", title: "Modification d'une visite", steps: ["Détail visite → Modifier, vider le titre, enregistrer", "Remettre un titre, enregistrer"], expected: "Refus sans titre ; titre modifié affiché ensuite" },
    ],
  },
  {
    id: "catalog", icon: "📦", title: "Actes & traitements", tests: [
      { id: "TC-038", title: "Créer un acte", steps: ["Actes → nouvel acte (nom, catégorie, prix, code)"], expected: "Acte disponible dans les sélecteurs de facturation" },
      { id: "TC-039", title: "Acte « par dent »", steps: ["Créer un acte avec Portée = dent et « Résultat sur la dent »", "Le facturer"], expected: "Le sélecteur de dents s'affiche ; quantité = nombre de dents ; dents imprimées sur la facture" },
      { id: "TC-040", title: "Traitement (package)", steps: ["Traitements → créer un package de plusieurs actes"], expected: "Prix = somme des actes (ou prix forcé) ; page détail avec les actes cliquables" },
      { id: "TC-041", title: "Actes « par bouche »", steps: ["Facturer un acte de portée bouche"], expected: "Aucun sélecteur de dents demandé" },
    ],
  },
  {
    id: "factures", icon: "🧾", title: "Factures & devis", tests: [
      { id: "TC-042", title: "Créer un devis", steps: ["Factures → nouveau document type devis"], expected: "PDF « DEVIS DENTAIRE » ; exclu des rapports de CA" },
      { id: "TC-043", title: "Facture en attente modifiable", steps: ["Modifier les lignes d'une facture en attente"], expected: "Lignes et total mis à jour" },
      { id: "TC-044", title: "Annuler / réactiver une facture", steps: ["Annuler une facture", "La réactiver"], expected: "Jamais supprimée : annulée = exclue des totaux ; réactivation possible" },
      { id: "TC-045", title: "PDF facture", steps: ["Télécharger le PDF d'une facture"], expected: "Logo du cabinet, lignes (dents incluses), acomptes du dossier, QR espace patient, pied « Généré par DentiCare »" },
      { id: "TC-046", title: "Feuille de soins CNOPS / CNSS", steps: ["Hub dossier → FDS CNOPS puis FDS CNSS"], expected: "Le vrai formulaire officiel est rempli (assuré, CIN, sexe, naissance, montant, INPE du praticien)" },
    ],
  },
  {
    id: "ordonnances", icon: "💊", title: "Ordonnances & médicaments", tests: [
      { id: "TC-047", title: "Créer une ordonnance", steps: ["Ordonnances → nouvelle (patient, visite liée, lignes)"], expected: "Ordonnance créée ; le sélecteur de visite affiche « date — titre »" },
      { id: "TC-048", title: "Médicament du catalogue", steps: ["Ajouter une ligne depuis le catalogue"], expected: "Posologie / durée / quantité pré-remplies" },
      { id: "TC-049", title: "Médicament libre auto-ajouté", steps: ["Saisir un médicament absent du catalogue, enregistrer"], expected: "Il est ajouté au catalogue Médicaments (sans doublon)" },
      { id: "TC-050", title: "PDF + annulation", steps: ["Imprimer l'ordonnance", "L'annuler"], expected: "PDF avec QR espace patient ; annulée = conservée mais marquée annulée" },
    ],
  },
  {
    id: "rdv", icon: "📅", title: "Rendez-vous & agenda", tests: [
      { id: "TC-051", title: "Nouveau RDV avec créneau", steps: ["Nouveau RDV → choisir un dentiste", "Sélectionner un créneau (clic début + clic fin) dans la grille"], expected: "Date + durée réglées ; créneaux occupés visibles ; avertissement en cas de chevauchement" },
      { id: "TC-052", title: "RDV contact rapide", steps: ["Nouveau RDV → + Contact rapide (prénom, nom, téléphone)", "Plus tard : « Créer la fiche patient »"], expected: "RDV enregistré sans patient ; la fiche patient est créée depuis le contact" },
      { id: "TC-053", title: "Statuts selon la date", steps: ["Ouvrir un RDV futur puis un RDV passé"], expected: "Futur : Planifié/Annulé ; passé : Terminé/Absent (dentiste) ou Annulé/Absent (assistant)" },
      { id: "TC-054", title: "Terminer un RDV → visite", steps: ["RDV passé → Terminé → nouvelle visite", "Vérifier le titre pré-rempli, le vider puis valider"], expected: "Titre pré-rempli avec celui du RDV ; refus si vide ; sinon visite créée et liée au RDV" },
      { id: "TC-055", title: "Lier un RDV à une visite existante", steps: ["Terminer un RDV → « visite existante »"], expected: "Liste « date — titre » ; le RDV affiche la visite liée" },
      { id: "TC-056", title: "Agenda semaine / jour", steps: ["Ouvrir 📆 Agenda, filtrer par praticien", "Cliquer un créneau vide"], expected: "Blocs colorés par dentiste ; clic vide ouvre un nouveau RDV pré-rempli" },
      { id: "TC-057", title: "Heure locale", steps: ["Créer un RDV à 10:00", "L'afficher dans la liste, l'agenda et le détail"], expected: "10:00 partout, sans décalage ni erreur d'hydratation" },
    ],
  },
  {
    id: "portal", icon: "🔗", title: "Espace patient (QR)", tests: [
      { id: "TC-058", title: "Accès par QR", steps: ["Scanner le QR d'une facture ou ordonnance", "Saisir la date de naissance"], expected: "Espace patient : infos, schéma dentaire (lecture seule), visites (titres), documents téléchargeables" },
      { id: "TC-059", title: "Mauvaise date de naissance", steps: ["Saisir une date de naissance erronée"], expected: "Accès refusé, aucune donnée affichée" },
    ],
  },
  {
    id: "support", icon: "🛟", title: "Support", tests: [
      { id: "TC-060", title: "Ouvrir un ticket", steps: ["Dashboard → Support → nouveau ticket avec pièce jointe"], expected: "Ticket créé ; l'équipe reçoit l'email avec la pièce jointe" },
      { id: "TC-061", title: "Réponse admin", steps: ["Admin → Support → répondre au ticket"], expected: "Statut « répondu » ; le demandeur reçoit l'email ; sa réponse rouvre le ticket" },
      { id: "TC-062", title: "Formulaire de contact public", steps: ["Ouvrir /fr/contact, envoyer un message"], expected: "Email reçu par l'équipe avec reply-to = l'expéditeur" },
    ],
  },
  {
    id: "settings", icon: "⚙️", title: "Paramètres", tests: [
      { id: "TC-063", title: "Infos + logo du cabinet", steps: ["Paramètres → modifier nom/adresse, charger un logo (< 2 Mo)", "Charger un logo > 2 Mo"], expected: "Logo affiché dans l'app et les PDF ; > 2 Mo refusé avec message traduit" },
      { id: "TC-064", title: "Praticiens + INPE", steps: ["Paramètres → ajouter un praticien avec INPE", "« Votre profil praticien » → le lier à son compte"], expected: "Praticien disponible partout où un dentiste est choisi ; l'agenda s'ouvre sur son praticien" },
      { id: "TC-065", title: "Changement de mot de passe", steps: ["Paramètres → nouveau mot de passe"], expected: "Mot de passe mis à jour, reconnexion possible" },
    ],
  },
  {
    id: "ui", icon: "🌐", title: "Langues & interface", tests: [
      { id: "TC-066", title: "Anglais et arabe", steps: ["Changer la langue en EN puis AR", "Parcourir les pages principales"], expected: "Tout est traduit (aucune clé brute) ; en arabe la mise en page est RTL" },
      { id: "TC-067", title: "Mode sombre", steps: ["Basculer le thème, recharger la page"], expected: "Le thème choisi est conservé après rechargement ; contraste lisible dans les deux thèmes" },
      { id: "TC-068", title: "Mobile (375 px)", steps: ["Ouvrir l'app sur téléphone"], expected: "Menu en tiroir, tableaux défilables, pas de scroll horizontal de page" },
      { id: "TC-069", title: "Clavier dans les modales", steps: ["Ouvrir une modale de création", "Entrée pour valider, Échap pour fermer"], expected: "Entrée enregistre, Échap ferme sans rien créer" },
      { id: "TC-070", title: "Recherche globale", steps: ["Rechercher un patient, un acte, une facture"], expected: "Résultats groupés, clic = page détail ; patients archivés marqués" },
      { id: "TC-076", title: "Mode clair par défaut", steps: ["Mettre l'ordinateur en thème sombre", "Ouvrir le site dans une fenêtre privée", "Basculer en sombre avec le bouton, recharger"], expected: "Le site s'ouvre en clair malgré le réglage de l'ordinateur ; le sombre n'apparaît que s'il a été choisi, et il est conservé au rechargement" },
    ],
  },
];
