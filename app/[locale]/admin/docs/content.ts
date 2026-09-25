export const DOCS_HTML = `
<h1>Documentation DentiCareApp</h1>
<p class="lead">Guide technique de l'application. Architecture, modèle multi-cabinet, schéma de base de données, authentification et fonctionnalités.</p>
<div class="chips">
  <span class="chip brand">Next.js 16</span>
  <span class="chip brand">Supabase</span>
  <span class="chip brand">TypeScript</span>
  <span class="chip green">App Router</span>
  <span class="chip green">RLS par cabinet</span>
  <span class="chip amber">next-intl (fr/en/ar)</span>
</div>

<h2>Introduction</h2>
<p>DentiCareApp est une application de gestion pour cabinets dentaires : patients, schéma dentaire, dossiers de soins, visites, actes & traitements, devis/factures & acomptes, feuilles de soins CNOPS/CNSS, ordonnances, rendez-vous & agenda, espace patient, fournisseurs et rapports. L'application est <strong>multi-cabinet</strong> : chaque cabinet (<code>practice</code>) a ses membres et ne voit que ses propres données, isolées par Row Level Security côté Supabase.</p>

<h2>Stack technique</h2>
<div class="table-wrap">
  <table>
    <tbody><tr><th>Couche</th><th>Technologie</th><th>Usage</th></tr>
    <tr><td><strong>Frontend</strong></td><td>Next.js 16 App Router</td><td>SSR, routing, composants serveur</td></tr>
    <tr><td><strong>Auth &amp; DB</strong></td><td>Supabase (PostgreSQL)</td><td>Auth JWT, RLS, Storage</td></tr>
    <tr><td><strong>Styles</strong></td><td>Tailwind CSS 4</td><td>Utility-first, dark mode</td></tr>
    <tr><td><strong>i18n</strong></td><td>next-intl</td><td>Routing <code>/fr</code> · <code>/en</code> · <code>/ar</code> (RTL)</td></tr>
    <tr><td><strong>PDF</strong></td><td>jsPDF + qrcode · pdf-lib</td><td>Factures, devis, ordonnances, fiche patient · feuilles CNOPS/CNSS officielles</td></tr>
    <tr><td><strong>Emails</strong></td><td>Resend</td><td>Confirmation, invitation, reset, support</td></tr>
    <tr><td><strong>Monitoring</strong></td><td>Sentry</td><td>Suivi des erreurs (org medicareapp)</td></tr>
    <tr><td><strong>Déploiement</strong></td><td>Vercel</td><td>CI/CD auto sur push</td></tr>
  </tbody></table>
</div>

<h2>Modèle multi-cabinet & rôles</h2>
<p>Un <code>practice</code> (cabinet) regroupe des <code>practice_members</code>. Chaque membre a un rôle : <strong>owner</strong>, <strong>dentist</strong> ou <strong>assistant</strong>. Un propriétaire s'inscrit (cabinet en attente d'approbation admin), puis invite ses membres, eux aussi approuvés par un admin.</p>
<ul>
  <li><strong>owner / dentist</strong> — accès complet (la gestion des membres reste réservée au propriétaire).</li>
  <li><strong>assistant</strong> — accueil uniquement : patients, dossiers, rendez-vous, agenda, support. Filtré côté UI (<code>utils/permissions.ts</code> + <code>RoleGuard</code>) <em>et</em> en base par des politiques <code>AS RESTRICTIVE</code> (<code>current_member_role() &lt;&gt; 'assistant'</code>) sur les 17 tables cliniques/facturation.</li>
</ul>
<div class="info-box">Les dentistes du cabinet sont aussi décrits dans <code>praticiens</code> (INPE <strong>par praticien</strong>, pas par cabinet). Un membre peut être lié à son praticien (<code>practice_members.praticien_id</code>).</div>

<h2>Schéma de base de données</h2>
<p>Les tables métier portent <code>practice_id uuid</code> pour l'isolation RLS, ainsi que <code>created_by</code> / <code>updated_by</code> (un trigger <code>stamp_updated_audit</code> renseigne automatiquement « Modifié par »). <code>archived_at</code> vaut <code>NULL</code> si actif (soft-delete).</p>

<h3>practices / practice_members / praticiens</h3>
<div class="table-wrap"><table>
  <tbody><tr><th>Colonne</th><th>Type</th><th>Description</th></tr>
  <tr><td><span class="schema-field">practices.id</span></td><td><span class="schema-type">uuid PK</span></td><td>name, address, phone, logo_url, is_approved</td></tr>
  <tr><td><span class="schema-field">practice_members.role</span></td><td><span class="schema-type">text</span></td><td>owner / dentist / assistant</td></tr>
  <tr><td><span class="schema-field">is_approved, deactivated_at</span></td><td><span class="schema-type">bool / ts</span></td><td>Validation admin + désactivation (jamais de suppression)</td></tr>
  <tr><td><span class="schema-field">praticiens.inpe</span></td><td><span class="schema-type">text</span></td><td>+ name, numero_ordre, speciality ; imprimé sur la feuille de soins</td></tr>
</tbody></table></div>

<h3>patients / tooth_chart</h3>
<div class="table-wrap"><table>
  <tbody><tr><th>Colonne</th><th>Type</th><th>Description</th></tr>
  <tr><td><span class="schema-field">first_name, last_name, cin, sexe</span></td><td><span class="schema-type">text</span></td><td>Identité (sexe M/F)</td></tr>
  <tr><td><span class="schema-field">phone, email, address, date_of_birth</span></td><td><span class="schema-type">text / date</span></td><td>Contact ; la date de naissance protège l'espace patient</td></tr>
  <tr><td><span class="schema-field">mutuelle_organisme / numero / lien</span></td><td><span class="schema-type">text</span></td><td>Alimente la feuille de soins</td></tr>
  <tr><td><span class="schema-field">public_token</span></td><td><span class="schema-type">uuid</span></td><td>Lien QR de l'espace patient <code>/p/&lt;token&gt;</code></td></tr>
  <tr><td><span class="schema-field">tooth_chart</span></td><td><span class="schema-type">—</span></td><td>État actuel : 1 ligne par patient + dent FDI : status (carie, obturee, couronne, a_traiter, prothese, bridge, implant, absente) + note + source_acte_id</td></tr>
  <tr><td><span class="schema-field">tooth_history</span></td><td><span class="schema-type">—</span></td><td>Journal de chaque changement (ancien → nouveau statut, acte d'origine, auteur, date), écrit par le trigger <code>trg_tooth_history</code> ; lecture seule côté app</td></tr>
  <tr><td><span class="schema-field">tooth_plan</span></td><td><span class="schema-type">—</span></td><td>Soins prévus par dent (planned / done / cancelled) ; passés à done automatiquement quand l'acte est facturé sur la dent</td></tr>
</tbody></table></div>

<h3>dossiers / acomptes</h3>
<div class="table-wrap"><table>
  <tbody><tr><th>Colonne</th><th>Type</th><th>Description</th></tr>
  <tr><td><span class="schema-field">dossiers.title, statut</span></td><td><span class="schema-type">text</span></td><td>Le « cas » de soin ; statut clinique ouvert / termine</td></tr>
  <tr><td><span class="schema-field">acomptes.montant, moyen</span></td><td><span class="schema-type">numeric / text</span></td><td>Paiements du dossier (especes / carte / virement / cheque / autre)</td></tr>
</tbody></table></div>
<div class="info-box">Reste à payer d'un dossier = Σ factures non annulées − Σ acomptes. Statut clinique et statut de paiement sont deux axes indépendants.</div>

<h3>consultations (« Visites »)</h3>
<div class="table-wrap"><table>
  <tbody><tr><th>Colonne</th><th>Type</th><th>Description</th></tr>
  <tr><td><span class="schema-field">title</span></td><td><span class="schema-type">text NOT NULL</span></td><td>Titre obligatoire, non vide (contrainte <code>consultations_title_not_blank</code>)</td></tr>
  <tr><td><span class="schema-field">motif</span></td><td><span class="schema-type">text</span></td><td>consultation / urgence / controle / soin / autre</td></tr>
  <tr><td><span class="schema-field">exam_date, next_exam_date</span></td><td><span class="schema-type">date</span></td><td>Jamais dans le futur (un futur = un RDV)</td></tr>
  <tr><td><span class="schema-field">dossier_id, praticien_id</span></td><td><span class="schema-type">uuid FK</span></td><td>+ treated_by, clinical_notes, exams</td></tr>
</tbody></table></div>

<h3>actes / traitements</h3>
<div class="table-wrap"><table>
  <tbody><tr><th>Colonne</th><th>Type</th><th>Description</th></tr>
  <tr><td><span class="schema-field">actes</span></td><td><span class="schema-type">—</span></td><td>Acte facturable atomique : name, category, price, code (cotation)</td></tr>
  <tr><td><span class="schema-field">actes.scope / tooth_status</span></td><td><span class="schema-type">text</span></td><td>mouth / tooth ; statut appliqué à la dent quand l'acte est facturé</td></tr>
  <tr><td><span class="schema-field">traitements + traitement_actes</span></td><td><span class="schema-type">—</span></td><td>Package réutilisable d'actes ; prix = price_override ou Σ actes</td></tr>
</tbody></table></div>

<h3>factures / facture_items</h3>
<div class="table-wrap"><table>
  <tbody><tr><th>Colonne</th><th>Type</th><th>Description</th></tr>
  <tr><td><span class="schema-field">factures.type</span></td><td><span class="schema-type">text</span></td><td>devis / facture (les devis sont exclus du CA)</td></tr>
  <tr><td><span class="schema-field">factures.status</span></td><td><span class="schema-type">text</span></td><td>en_attente / en_cours / payee / annulee</td></tr>
  <tr><td><span class="schema-field">facture_items.acte_id, teeth[]</span></td><td><span class="schema-type">uuid / text[]</span></td><td>+ acte_date (date de la visite), quantity, unit_price</td></tr>
</tbody></table></div>

<h3>appointments</h3>
<div class="table-wrap"><table>
  <tbody><tr><th>Colonne</th><th>Type</th><th>Description</th></tr>
  <tr><td><span class="schema-field">scheduled_at, duration_minutes</span></td><td><span class="schema-type">timestamptz / int</span></td><td>Instant UTC, affiché en heure locale (<code>LocalInstant</code>)</td></tr>
  <tr><td><span class="schema-field">type</span></td><td><span class="schema-type">text</span></td><td>consultation / nettoyage / soin / chirurgie / controle / orthodontie / autre</td></tr>
  <tr><td><span class="schema-field">status</span></td><td><span class="schema-type">text</span></td><td>planifie / termine / annule / absent</td></tr>
  <tr><td><span class="schema-field">consultation_id, dossier_id, praticien_id</span></td><td><span class="schema-type">uuid FK</span></td><td>Lien vers la visite produite, le dossier, le dentiste</td></tr>
  <tr><td><span class="schema-field">contact_first_name / last_name / phone</span></td><td><span class="schema-type">text</span></td><td>« Contact rapide » quand il n'y a pas encore de fiche patient</td></tr>
</tbody></table></div>

<h3>Ordonnances, fournisseurs & support</h3>
<div class="table-wrap"><table>
  <tbody><tr><th>Table</th><th>Rôle</th></tr>
  <tr><td><span class="schema-field">ordonnances / ordonnance_lignes</span></td><td>Prescriptions médicamenteuses (status active / annulee, jamais supprimées)</td></tr>
  <tr><td><span class="schema-field">medicaments</span></td><td>Catalogue avec posologie / durée / quantité par défaut</td></tr>
  <tr><td><span class="schema-field">suppliers / supplier_orders / supplier_order_items / treatment_suppliers</span></td><td>Fournisseurs, commandes fournisseur, lien acte ↔ fournisseur</td></tr>
  <tr><td><span class="schema-field">treatment_attributes</span></td><td>Catégories / options du catalogue de soins</td></tr>
  <tr><td><span class="schema-field">support_tickets / support_messages / support_attachments</span></td><td>Tickets de support (fil + pièces jointes)</td></tr>
  <tr><td><span class="schema-field">qa_test_results</span></td><td>Suivi des tests QA (panneau admin, service role uniquement)</td></tr>
</tbody></table></div>

<h2>RLS &amp; Sécurité</h2>
<p>Row Level Security est activé sur toutes les tables métier. Les politiques utilisent l'appartenance au cabinet (helper <code>current_practice_id()</code>) ; les tables enfants (facture_items, traitement_actes, ordonnance_lignes…) passent par une jointure sur leur parent. Les restrictions du rôle assistant s'ajoutent en politiques <strong>restrictives</strong>.</p>
<div class="info-box">Les Server Components appellent <code>createClient()</code> (JWT de l'utilisateur, RLS appliqué). Les routes admin, l'espace patient (<code>/api/portal</code>) et les réponses support admin utilisent <code>createAdminClient()</code> (service role) et sont protégées côté serveur.</div>

<h2>Authentification</h2>
<p>Supabase Auth (email + mot de passe). Connexion via <code>/[locale]/signin</code>. Le layout du dashboard redirige vers <code>/signin</code> sans session, bloque un cabinet non approuvé (écran d'attente) et un membre désactivé.</p>
<ul>
  <li><strong>Inscription</strong> : confirmation email → <code>/auth/callback</code> → email « Nouvelle inscription » à l'équipe → approbation dans <code>/admin</code>.</li>
  <li><strong>Réinitialisation</strong> : <code>/forgot-password</code> → email → <code>/reset-password/callback</code> (chemin propre, sans query) → « Nouveau mot de passe ».</li>
  <li><strong>Invitation membre</strong> : email d'invitation → <code>/reset-password</code> (flux implicite, fragment <code>#access_token</code>) → « Activer mon compte ».</li>
</ul>

<h2>Internationalisation</h2>
<p>next-intl avec segment <code>[locale]</code>. Locales : <code>fr</code> (défaut), <code>en</code>, <code>ar</code> (RTL). Traductions dans <code>messages/{fr,en,ar}.json</code> — chaque chaîne existe dans les 3 langues. <code>tsc</code> ne détecte pas une clé manquante : vérifier la parité des 3 fichiers avant chaque commit.</p>
<div class="warn-box">⚠️ Les chemins contenant <code>[locale]</code> nécessitent <code>-LiteralPath</code> en PowerShell (les crochets sont des wildcards).</div>

<h2>Pattern composants</h2>
<p>Chaque page suit le pattern <strong>Server Component</strong> (<code>page.tsx</code>, fetch Supabase côté serveur) + <strong>Client Component</strong> (<code>XxxClient.tsx</code>, UI interactive). Le contexte de tenance se lit via <code>useAppContext()</code> (practiceId, currentUserId, rôle, membres…). Un clic sur une ligne ouvre une <strong>page détail</strong> ; les modales servent à créer / modifier.</p>

<h2>Fonctionnalités clés</h2>
<ul>
  <li><strong>Patients</strong> — CRUD + archivage cascade ; fiche avec vue rapide, historique, schéma dentaire et fiche imprimable.</li>
  <li><strong>Schéma dentaire</strong> — odontogramme anatomique adulte/enfant (auto selon l'âge), mis à jour par la facturation des actes par dent ; soins prévus (pointillés, plan de traitement) et historique daté par dent.</li>
  <li><strong>Dossiers</strong> — hub du cas de soin : documents, acomptes, visites, RDV, ordonnances, feuilles de soins.</li>
  <li><strong>Visites</strong> — titre obligatoire, facturation d'actes (dossier créé automatiquement si besoin), actes réalisés.</li>
  <li><strong>Actes & traitements</strong> — catalogue à 2 niveaux (actes atomiques + packages).</li>
  <li><strong>Factures & devis</strong> — annulation au lieu de suppression, PDF avec dents, acomptes et QR patient.</li>
  <li><strong>Feuilles de soins</strong> — remplissage des vrais formulaires CNOPS / CNSS (pdf-lib), par dossier.</li>
  <li><strong>Ordonnances</strong> — lignes depuis le catalogue Médicaments, PDF, annulation.</li>
  <li><strong>Rendez-vous & Agenda</strong> — grille de créneaux par dentiste, contact rapide, statuts selon la date, « Terminé » → visite.</li>
  <li><strong>Espace patient</strong> — accès par QR + date de naissance : infos, schéma, visites, documents.</li>
  <li><strong>Support</strong> — tickets avec fil de discussion, pièces jointes et notifications email.</li>
  <li><strong>Rapports</strong> — KPIs et chiffre d'affaires (devis et factures annulées exclus).</li>
</ul>

<h2>Archivage (soft-delete)</h2>
<p>Les enregistrements sont archivés (<code>archived_at = now()</code>) plutôt que supprimés. Les documents médicaux et financiers (factures, ordonnances) sont <strong>annulés, jamais supprimés</strong> ; un devis reste supprimable. Les membres sont désactivés, et les clés <code>user_id</code> sont en <code>ON DELETE SET NULL</code> pour ne jamais perdre les données d'un cabinet.</p>
`;
