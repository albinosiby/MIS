"use client";

import type { ComplianceCheck, SigningAuthoritySummary } from "../models";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FigmaAsset } from "@/components/layout/figma-asset";
import { figmaAssets } from "@/components/layout/figma-assets";

export function SetupGovernance({
  inspect,
  checks,
  authority,
}: {
  inspect: (title: string, content?: ReactNode) => void;
  checks: ComplianceCheck[];
  authority: SigningAuthoritySummary;
}) {
  return (
    <aside
      className="workspace-governance"
      aria-label="Governance and authorisation"
    >
      <section className="setup-panel compliance-panel">
        <header>
          <h2>
            <FigmaAsset group="workspace" name="imgContainer5" />
            Statutory Compliance
          </h2>
          <span className="all-pass">
            {checks.length && checks.every((check) => check.status === "pass")
              ? "ALL PASS"
              : "REVIEW"}
          </span>
        </header>
        {checks.map((check) => (
          <div key={check.id} className="compliance-row">
            <div>
              <h3>{check.label}</h3>
              <p>{check.detail}</p>
            </div>
            <div>
              <strong
                className={
                  check.id === "cbse-oasis"
                    ? "compliant"
                    : check.id === "apaar"
                      ? "coverage"
                      : undefined
                }
              >
                {check.value}
              </strong>
              <p
                className={
                  check.id === "udise-ptr" || check.id === "rte-quota"
                    ? "compliant"
                    : undefined
                }
              >
                {check.supportingText}
              </p>
            </div>
          </div>
        ))}
      </section>
      <section className="setup-panel authority-panel">
        <h2>
          <FigmaAsset group="workspace" name="imgContainer6" />
          Institutional DSC Authority
        </h2>
        <div className="authority-user">
          <img
            src={figmaAssets.workspace.imgDrRajivSharma.src}
            alt=""
            width={44}
            height={44}
          />
          <div>
            <h3>{authority.staff.displayName}</h3>
            <p>{authority.staff.designation}</p>
            <small className="compliant">
              ● Class 3 Hardware Token {authority.tokenStatus}
            </small>
          </div>
        </div>
        <dl className="authority-details">
          <div>
            <dt>Token Serial:</dt>
            <dd>{authority.tokenSerial}</dd>
          </div>
          <div>
            <dt>SHA-256 Fingerprint:</dt>
            <dd>{authority.fingerprintDisplay}</dd>
          </div>
          <div>
            <dt>Roll-Forward Scope:</dt>
            <dd>
              {authority.ledgerCount.toLocaleString("en-IN")} Ledgers,{" "}
              {authority.rosterCount} Roster
            </dd>
          </div>
        </dl>
        <Button
          variant="secondary"
          className="sign-button"
          onClick={() =>
            inspect(
              "Session rollover authorisation",
              <>
                <p>
                  The design shows a Class 3 hardware token. This preview has no
                  digital-signature provider or signing credential connected.
                </p>
                <p>
                  No session rollover can be authorised here. Review all
                  ingestion discrepancies before implementing the live signing
                  flow.
                </p>
              </>,
            )
          }
        >
          <FigmaAsset group="workspace" name="imgContainer7" />
          <span>
            Sign Session Rollover
            <br />
            Authorization
          </span>
        </Button>
      </section>
    </aside>
  );
}
