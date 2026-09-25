// Last-resort 404 outside any locale (e.g. an invalid locale segment). No
// next-intl provider at this level, so the text is static French + English.
export default function RootNotFound() {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 420, margin: 24, background: "#fff", border: "1px solid #e4e4e7", borderRadius: 16, padding: 32, textAlign: "center" }}>
          <img src="/logo.svg" alt="DentiCareApp" width={40} height={40} />
          <p style={{ margin: "16px 0 4px", fontSize: 12, letterSpacing: 2, color: "#a1a1aa", fontWeight: 600 }}>ERREUR 404 · ERROR 404</p>
          <h1 style={{ margin: 0, fontSize: 22, color: "#18181b" }}>Page introuvable</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#71717a" }}>Page not found</p>
          <a href="/" style={{ display: "inline-block", marginTop: 24, padding: "10px 20px", borderRadius: 8, background: "#0d9488", color: "#fff", fontSize: 14, textDecoration: "none" }}>← Retour à l&apos;accueil · Back to home</a>
        </div>
      </body>
    </html>
  );
}
