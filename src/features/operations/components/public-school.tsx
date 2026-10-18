"use client";
import { useState } from "react";
import Link from "next/link";
import { SchoolLogo } from "@/components/branding/school-logo";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import { useBackend } from "../../identity/components/identity-context";
import { verifyCloudCertificate } from "../../cloud/server/public-actions";
import Admissions from "../../admissions/components/admissions-screens";
export function PublicSchool({ slug }: { slug: string }) {
  const { year } = useWorkspace();
  const cloud = useBackend() === "supabase";
  const [verified, setVerified] = useState<{
    type: string;
    issuedOn: string;
    school: string;
  } | null>(null);
  const [verificationStatus, setVerificationStatus] = useState("");
  const [reference, setReference] = useState("");
  const release = year.workflows.websiteReleases.find(
    (release) => release.id === year.workflows.activeWebsiteReleaseId,
  );
  const school = cloud
    ? year.setup.school
    : (release?.school ?? year.setup.school);
  const published = (cloud ? year.extensions : (release?.content ?? [])).filter(
    (r) =>
      ["cms-pages", "cms-news"].includes(r.kind) && r.status === "published",
  );
  if (slug === "verify-certificate") {
    const certificate = cloud
      ? verified
      : year.records.certificates.find(
          (c) => c.reference === reference && c.status === "issued",
        );
    return (
      <main id="main-content" className="identity-single">
        <div className="identity-card">
          <h1>Verify certificate</h1>
          <p>
            Enter the reference from an issued certificate. This local preview
            is not a public signing or government verification service.
          </p>
          <label>
            Certificate reference
            <input
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setVerified(null);
                setVerificationStatus("");
              }}
            />
          </label>
          {cloud && (
            <button
              className="identity-submit"
              onClick={async () => {
                try {
                  setVerificationStatus("Checking…");
                  const result = await verifyCloudCertificate(reference);
                  setVerified(result);
                  setVerificationStatus(
                    result
                      ? ""
                      : "No issued certificate matches this reference.",
                  );
                } catch {
                  setVerificationStatus(
                    "Verification is unavailable. Check the reference and try again.",
                  );
                }
              }}
            >
              Verify certificate
            </button>
          )}
          {verificationStatus && <p role="status">{verificationStatus}</p>}
          {reference &&
            (!cloud || certificate) &&
            (certificate ? (
              <div role="status" className="identity-banner">
                Issued · {certificate.type} · {certificate.issuedOn}
                <p>{school.name}</p>
              </div>
            ) : (
              <p role="status">
                No issued certificate matches this reference in this browser.
              </p>
            ))}
          <Link href="/school-site">School site →</Link>
        </div>
      </main>
    );
  }
  if (slug === "admissions")
    return (
      <main id="main-content" className="op-content">
        <Link href="/school-site">← School site</Link>
        <div className="op-notice">
          {cloud
            ? "School admission enquiry · Submitted securely to the school."
            : "Public admission preview · Saved in this browser."}
        </div>
        <Admissions
          route="/admissions/public-form"
          query={{ apply: "1", public: "1" }}
          search=""
        />
      </main>
    );
  const page = published.find(
    (r) => r.kind === "cms-pages" && r.values.slug === slug,
  );
  return (
    <div className="min-h-screen bg-white">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b p-6">
        <Link className="identity-brand" href="/school-site">
          <SchoolLogo size={36} /> {school.shortName}
        </Link>
        <nav className="op-links">
          {published
            .filter((p) => p.kind === "cms-pages")
            .map((p) => (
              <Link
                key={p.id}
                href={`/school-site/${encodeURIComponent(String(p.values.slug))}`}
              >
                {p.title}
              </Link>
            ))}
          <Link href="/school-site/admissions">Admissions</Link>
          <Link href="/login">Portal sign in</Link>
        </nav>
      </header>
      <main id="main-content" className="max-w-6xl mx-auto p-8">
        <div className="op-notice">
          {cloud
            ? "School website · Published school information."
            : "Local public-site preview · Published content from this browser."}
        </div>
        <span className="op-eyebrow">Learning • Community • Growth</span>
        <h1 className="text-4xl font-semibold my-6">
          {page?.title ?? (slug ? "Page not published" : school.name)}
        </h1>
        {page ? (
          <article className="op-card whitespace-pre-wrap">
            {String(page.values.body)}
          </article>
        ) : !slug ? (
          <>
            <p className="text-slate-500 leading-8 max-w-2xl">
              A connected school community. Discover our latest news, explore
              admissions and access your school portal.
            </p>
            <div className="op-links my-8">
              <Link href="/school-site/admissions">Apply for admission →</Link>
              <Link href="/login/parent">Parent sign in →</Link>
            </div>
            <div className="op-cards">
              {published
                .filter((p) => p.kind === "cms-news")
                .map((n) => (
                  <article className="op-card" key={n.id}>
                    <small>{n.date}</small>
                    <h2>{n.title}</h2>
                    <p className="whitespace-pre-wrap">
                      {String(n.values.body)}
                    </p>
                  </article>
                ))}
            </div>
            {!published.length && (
              <p className="op-empty">
                The school has not published pages or news yet.
              </p>
            )}
          </>
        ) : (
          <p>Only published school pages appear here.</p>
        )}
      </main>
      <footer className="border-t p-8 text-sm text-slate-500">
        {school.name} · {school.address.city} · {school.email}
      </footer>
    </div>
  );
}
