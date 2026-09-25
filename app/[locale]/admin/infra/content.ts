export const INFRA_HTML = `
<h1 class="infra-title">Infrastructure DentiCareApp</h1>
<p class="infra-lead">Architecture, services et coûts. DentiCareApp et OptiCareApp font partie de la même maison — <strong>MediCareApp</strong>.</p>

<h2 class="infra-h2">Stack de production</h2>
<div class="infra-grid">
  <div class="infra-card"><div class="infra-card-icon">▲</div><div class="infra-card-name">Vercel</div><div class="infra-card-role">Hébergement Next.js, CI/CD automatique sur push GitHub</div><span class="infra-card-cost">~0–20 $/mois</span></div>
  <div class="infra-card"><div class="infra-card-icon">🗄</div><div class="infra-card-name">Supabase</div><div class="infra-card-role">PostgreSQL managé (eu-central-1), Auth JWT, RLS, Storage (logos, pièces jointes support)</div><span class="infra-card-cost">~0–25 $/mois</span></div>
  <div class="infra-card"><div class="infra-card-icon">📧</div><div class="infra-card-name">Resend</div><div class="infra-card-role">Emails : confirmation, invitation membre, réinitialisation, tickets de support</div><span class="infra-card-cost">~0–10 $/mois</span></div>
  <div class="infra-card"><div class="infra-card-icon">🛡️</div><div class="infra-card-name">Sentry</div><div class="infra-card-role">Suivi des erreurs (org medicareapp) — sans Session Replay (données patients)</div><span class="infra-card-cost">Free / ~26 $/mois</span></div>
  <div class="infra-card"><div class="infra-card-icon">⏱️</div><div class="infra-card-name">UptimeRobot</div><div class="infra-card-role">Surveillance de disponibilité (ping du domaine, alerte email)</div><span class="infra-card-cost">Gratuit</span></div>
  <div class="infra-card"><div class="infra-card-icon">🌩️</div><div class="infra-card-name">Cloudflare</div><div class="infra-card-role">DNS + proxy devant le domaine ; routage email amine@denticareapp.com</div><span class="infra-card-cost">Gratuit</span></div>
  <div class="infra-card"><div class="infra-card-icon">🐙</div><div class="infra-card-name">GitHub</div><div class="infra-card-role">Source control ; déclenche le déploiement Vercel</div><span class="infra-card-cost">Gratuit</span></div>
  <div class="infra-card"><div class="infra-card-icon">🌐</div><div class="infra-card-name">Domaine</div><div class="infra-card-role">denticareapp.com (canonique www) — production active</div><span class="infra-card-cost">Actif ✓</span></div>
</div>

<h2 class="infra-h2">Estimation des coûts mensuels</h2>
<div class="table-wrap">
  <table>
    <tbody><tr><th>Service</th><th>Plan</th><th>Coût base</th><th>Variable</th></tr>
    <tr><td><strong>Vercel</strong></td><td>Hobby (gratuit) / Pro $20</td><td>$0</td><td>+$20 selon usage</td></tr>
    <tr><td><strong>Supabase</strong></td><td>Free tier / Pro</td><td>$0</td><td>Pro facturé par organisation : ~$35/mois pour les 2 apps</td></tr>
    <tr><td><strong>Resend</strong></td><td>Free 3 000 emails/mois</td><td>$0</td><td>+$20 au-delà</td></tr>
    <tr><td><strong>Sentry</strong></td><td>Free / Team $26</td><td>$0</td><td>selon volume d'événements</td></tr>
    <tr><td><strong>UptimeRobot / Cloudflare</strong></td><td>Free</td><td>$0</td><td>—</td></tr>
    <tr><td><strong>Total base</strong></td><td colspan="2"><strong>~$0–$91/mois</strong></td><td>selon usage</td></tr>
  </tbody></table>
</div>
<div class="warn-box">⚠️ En Free, Supabase met le projet en veille après une période d'inactivité : la première connexion peut prendre 30–60 s (démarrage à froid). Supabase Pro supprime la mise en veille et ajoute des sauvegardes quotidiennes.</div>

<h2 class="infra-h2">Niveaux de déploiement</h2>
<div class="tier-grid">
  <div class="tier-card"><div class="tier-name">STARTER</div><div class="tier-price">$0 <span>/mois</span></div><ul class="tier-features"><li>Vercel Hobby</li><li>Supabase Free</li><li>Resend / Sentry / UptimeRobot Free</li><li>Domaine via Cloudflare</li></ul></div>
  <div class="tier-card featured"><div class="tier-name">PRODUCTION ★</div><div class="tier-price">$45 <span>/mois</span></div><ul class="tier-features"><li>Vercel Pro ($20)</li><li>Supabase Pro ($25)</li><li>Backups quotidiens, pas de veille</li><li>Monitoring & uptime actifs</li></ul></div>
  <div class="tier-card"><div class="tier-name">SCALE</div><div class="tier-price">$91+ <span>/mois</span></div><ul class="tier-features"><li>Vercel + Supabase Pro + usage</li><li>Base dev séparée</li><li>Sentry Team</li><li>Emails volume élevé</li></ul></div>
</div>

<h2 class="infra-h2">Flux de déploiement</h2>
<ol class="flow-steps">
  <li><strong>Vérifications locales</strong> — <code>tsc --noEmit</code> + parité des traductions fr/en/ar</li>
  <li><strong>Push GitHub</strong> — sur <code>main</code> (historique linéaire)</li>
  <li><strong>Vercel build</strong> — build Next.js ; les erreurs runtime remontent dans Sentry</li>
  <li><strong>Production</strong> — en ligne en ~2 min, servie derrière Cloudflare</li>
  <li><strong>Migrations</strong> — appliquées sur Supabase via la Management API (<code>scripts/apply-migration.mjs</code>), idempotentes ; une contrainte bloquante s'applique après le déploiement du code</li>
</ol>
<div class="info-box">Le développement local utilise aujourd'hui la même base que la production : les tests locaux écrivent de vraies données.</div>

<h2 class="infra-h2">Sécurité & observabilité</h2>
<p class="infra-p"><strong>RLS Supabase</strong> : isolation par <code>practice_id</code> (cabinet) + politiques restrictives pour le rôle assistant. <strong>Service role</strong> : réservé aux routes serveur (admin, espace patient, réponses support). <strong>Espace patient</strong> : accès par jeton QR + date de naissance, validé côté serveur. <strong>Secrets</strong> : variables d'environnement Vercel (<code>.env.local</code> jamais commité). <strong>HTTPS</strong> partout. <strong>Sentry</strong> sans capture de session ; <strong>UptimeRobot</strong> surveille la disponibilité.</p>

<h2 class="infra-h2">Emails transactionnels (Resend)</h2>
<div class="table-wrap">
  <table>
    <tbody><tr><th>Événement</th><th>Destinataire</th><th>Contenu</th></tr>
    <tr><td>Inscription cabinet</td><td>Équipe (amine + yasmine)</td><td>Nouvelle inscription à approuver</td></tr>
    <tr><td>Invitation membre</td><td>Membre invité</td><td>Lien pour activer le compte</td></tr>
    <tr><td>Mot de passe oublié</td><td>Utilisateur</td><td>Lien de réinitialisation (nouvel onglet)</td></tr>
    <tr><td>Ticket de support</td><td>Équipe ↔ cabinet</td><td>Nouveau ticket / réponse, pièces jointes</td></tr>
    <tr><td>Formulaire de contact</td><td>Équipe</td><td>Message du site public</td></tr>
  </tbody></table>
</div>
<div class="info-box">Les rappels de RDV sont envoyés à la main (bouton WhatsApp). Aucun SMS automatique n'est branché.</div>

<h2 class="infra-h2">Domaines de production</h2>
<div class="infra-grid">
  <div class="infra-card"><div class="infra-card-icon">🦷</div><div class="infra-card-name">denticareapp.com</div><div class="infra-card-role">DentiCareApp — cabinets dentaires</div><span class="infra-card-cost">Live ✓</span></div>
  <div class="infra-card"><div class="infra-card-icon">👓</div><div class="infra-card-name">opticareapp.com</div><div class="infra-card-role">OptiCareApp — opticiens, même stack (projets Supabase et Vercel séparés)</div><span class="infra-card-cost">Live ✓</span></div>
</div>

<h2 class="infra-h2">Application Mobile — Roadmap</h2>
<p class="infra-p">L'app peut être portée en natif iOS/Android via <strong>Expo (React Native)</strong>. Le code métier (client Supabase, types TypeScript) est réutilisable ; seule la couche UI est à réécrire.</p>
<div class="table-wrap">
  <table>
    <tbody><tr><th>Couche</th><th>Web (Next.js)</th><th>Mobile (Expo)</th><th>Réutilisation</th></tr>
    <tr><td><strong>Auth &amp; DB</strong></td><td>@supabase/ssr</td><td>@supabase/supabase-js</td><td>✓ 100% identique</td></tr>
    <tr><td><strong>Types TS</strong></td><td>types/database.ts</td><td>types/database.ts</td><td>✓ 100% identique</td></tr>
    <tr><td><strong>Logique métier</strong></td><td>Server Components</td><td>Hooks React Native</td><td>~80% adaptable</td></tr>
    <tr><td><strong>UI / Layout</strong></td><td>Tailwind CSS + HTML</td><td>StyleSheet + View/Text</td><td>✗ à réécrire</td></tr>
    <tr><td><strong>i18n</strong></td><td>next-intl</td><td>i18next / expo-localization</td><td>~50% adaptable</td></tr>
  </tbody></table>
</div>
`;
