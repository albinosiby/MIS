"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import { downloadFile } from "../../school-setup/components/setup-ingestion";
import { readableError } from "../../school-setup/components/form-errors";
import { importMarksCsv, marksTemplate } from "../domain/import-marks";
export function MarksImport({
  examId,
  onClose,
}: {
  examId: string;
  onClose: () => void;
}) {
  const { year, mutate, busy } = useWorkspace();
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  return (
    <Dialog title="Import Marks (CSV)" onClose={onClose}>
      <p>
        Use admission numbers and subject codes from the selected exam template.
        Blank marks stay unchanged. The entire file is validated before one
        atomic save.
      </p>
      <div className="ws-actions">
        <Button
          variant="outline"
          onClick={() =>
            downloadFile(
              "exam-marks-template.csv",
              marksTemplate(year, examId),
              "text/csv;charset=utf-8",
            )
          }
        >
          Download current marks template
        </Button>
      </div>
      <label htmlFor="marks-csv-file">Choose filled CSV (up to 1 MB)</label>
      <Input
        id="marks-csv-file"
        type="file"
        accept=".csv,text/csv"
        onChange={async (e) => {
          try {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 1_000_000)
              throw new Error("CSV must be smaller than 1 MB.");
            setText(await file.text());
            setError("");
          } catch (error) {
            setError(readableError(error));
          }
        }}
      />
      <label htmlFor="marks-csv-text">Or paste CSV</label>
      <textarea
        className="school-input"
        id="marks-csv-text"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && (
        <p className="config-errors" role="alert">
          {error}
        </p>
      )}
      <Button
        disabled={busy || !text}
        onClick={async () => {
          try {
            await mutate(
              (y) => importMarksCsv(y, examId, text),
              "Imported validated exam marks CSV",
            );
            onClose();
          } catch (error) {
            setError(readableError(error));
          }
        }}
      >
        Validate & import marks
      </Button>
    </Dialog>
  );
}
