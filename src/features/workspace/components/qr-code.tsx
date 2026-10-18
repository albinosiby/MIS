"use client";
import { useEffect, useState } from "react";
export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((q) =>
        q.toDataURL(value, {
          width: 240,
          margin: 2,
          color: { dark: "#0f172a", light: "#ffffff" },
        }),
      )
      .then((data) => {
        if (!cancelled) setSrc(data);
      })
      .catch(() => setError("QR code could not be generated."));
    return () => {
      cancelled = true;
    };
  }, [value]);
  return (
    <figure>
      {src ? (
        <img src={src} alt={label} width={240} height={240} />
      ) : (
        <p role={error ? "alert" : "status"}>
          {error || "Generating QR code…"}
        </p>
      )}
      <figcaption className="ws-hint">{label}</figcaption>
    </figure>
  );
}
