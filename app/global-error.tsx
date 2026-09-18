"use client";

// Catches errors thrown in the root layout itself (catastrophic fallback only —
// it replaces the whole app, so it lives outside the next-intl locale provider
// and cannot use t()). Normal page errors are handled inside [locale].
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Une erreur est survenue
          </h1>
          <p style={{ color: "#555" }}>
            An error occurred · حدث خطأ
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0d9488",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Recharger · Reload
          </button>
        </div>
      </body>
    </html>
  );
}
