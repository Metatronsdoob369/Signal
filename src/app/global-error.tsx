"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily: "ui-monospace, monospace",
          background: "#f7f4ef",
          color: "#141414",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Signal hit an error</h1>
          <p style={{ color: "#5c5c5c", marginBottom: "1.25rem" }}>
            {error.message || "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#141414",
              color: "#f7f4ef",
              border: 0,
              padding: "0.75rem 1.25rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
