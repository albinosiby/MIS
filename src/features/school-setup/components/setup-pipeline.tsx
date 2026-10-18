"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FigmaAsset } from "@/components/layout/figma-asset";
import type { SetupPhase } from "../models";
import type { ReactNode } from "react";

export function SetupPipeline({
  inspect,
  phases,
}: {
  inspect: (title: string, content?: ReactNode) => void;
  phases: SetupPhase[];
}) {
  return (
    <>
      <section
        className="setup-panel setup-pipeline"
        aria-labelledby="pipeline-heading"
      >
        <div className="pipeline-heading">
          <div>
            <div className="heading-line">
              <h2 id="pipeline-heading">Academic Roll-Forward Pipeline</h2>
              <span className="stage-badge">
                {phases.every((phase) => phase.status === "completed")
                  ? "ALL PHASES COMPLETED"
                  : `STAGE ${phases.findIndex((phase) => phase.status === "in_progress") + 1} OF ${phases.length} RUNNING`}
              </span>
            </div>
            <p>
              Sequential setup steps with local validation and persistent data.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              inspect(
                "Setup dependency sequence",
                <ol className="dependency-list">
                  {phases.map((phase, index) => (
                    <li key={phase.title}>
                      <b>
                        {String(index + 1).padStart(2, "0")} · {phase.title}
                      </b>
                      <p>{phase.description}</p>
                      {phase.status === "locked" && (
                        <small>
                          Complete the preceding phase to unlock this step.
                        </small>
                      )}
                    </li>
                  ))}
                </ol>,
              )
            }
          >
            <FigmaAsset group="pipeline" name="imgContainer" />
            View Dependency Graph
          </Button>
        </div>
        <div className="phase-grid">
          {phases.map((phase, index) => (
            <Link
              key={phase.id}
              href={`/school-setup/${phase.id}`}
              aria-disabled={phase.status === "locked"}
              className={`phase-card ${phase.status === "in_progress" ? "current-phase" : ""} ${phase.status === "locked" ? "locked-phase" : ""}`}
            >
              {phase.status === "in_progress" && (
                <span className="current-label">CURRENT</span>
              )}
              <div className="phase-top">
                <span>PHASE {String(index + 1).padStart(2, "0")}</span>
                <FigmaAsset
                  group="pipeline"
                  name={
                    phase.status === "completed"
                      ? "imgContainer1"
                      : phase.status === "in_progress"
                        ? "imgContainer2"
                        : "imgContainer3"
                  }
                />
              </div>
              <h3>{phase.title}</h3>
              <p>{phase.description}</p>
              <div className="phase-footer">
                <span
                  className={`phase-status ${phase.status === "in_progress" ? "running" : phase.status === "locked" ? "locked" : ""}`}
                >
                  {phase.status === "completed"
                    ? "COMPLETED"
                    : phase.status === "in_progress"
                      ? "● IN PROGRESS"
                      : "LOCKED"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
