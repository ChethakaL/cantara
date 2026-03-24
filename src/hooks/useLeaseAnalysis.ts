import { useState, useCallback } from "react";
import { AnalysisStatus, LeaseDocument, LeaseReport } from "@/lib/lease-analysis/types";
import { convertPdfToBase64 } from "@/lib/lease-analysis/pdf-to-base64";
import { parseReport } from "@/lib/lease-analysis/parse-report";

const ANALYZE_MAX_ATTEMPTS = 3;
const ANALYZE_RETRY_DELAYS_MS = [1000, 2500];

export function useLeaseAnalysis(clientId?: string) {
  const [documents, setDocuments] = useState<LeaseDocument[]>([]);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [rawMarkdown, setRawMarkdown] = useState("");
  const [report, setReport] = useState<LeaseReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addDocuments = async (files: File[]) => {
    // Basic validation
    const pdfFiles = files.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    
    if (pdfFiles.length === 0) {
      setError("Only PDF files are accepted.");
      return;
    }
    
    if (documents.length + pdfFiles.length > 5) {
      setError("Maximum 5 documents per analysis.");
      return;
    }

    try {
      const newDocs: LeaseDocument[] = [];
      for (const file of pdfFiles) {
        if (file.size > 32 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds 32MB limit.`);
        }
        
        // Prevent duplicates based on name and size
        if (documents.some(d => d.name === file.name && d.sizeBytes === file.size)) {
          continue; // skip duplicate
        }

        const base64 = await convertPdfToBase64(file);
        newDocs.push({
          name: file.name,
          base64,
          mediaType: "application/pdf",
          sizeBytes: file.size,
        });
      }

      setDocuments(prev => [...prev, ...newDocs]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process files.");
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  const clearAll = () => {
    setDocuments([]);
    setStatus("idle");
    setRawMarkdown("");
    setReport(null);
    setError(null);
  };

  const analyze = useCallback(async () => {
    if (documents.length === 0) {
      setError("Please upload at least one lease document.");
      return;
    }

    setStatus("uploading");
    setRawMarkdown("");
    setReport(null);
    setError(null);

    try {
      let accumulated = "";

      for (let attempt = 1; attempt <= ANALYZE_MAX_ATTEMPTS; attempt += 1) {
        let attemptMarkdown = "";

        try {
          const res = await fetch("/api/lease-analysis/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documents, clientId }),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw withStatus(new Error(extractErrorMessage(errText) || "API Request Failed"), res.status);
          }

          if (!res.body) {
            throw new Error("No response body returned from API");
          }

          console.log(`[useLeaseAnalysis] Starting stream reader (attempt ${attempt}/${ANALYZE_MAX_ATTEMPTS})...`);

          setStatus("streaming");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            attemptMarkdown += chunk;
            setRawMarkdown(attemptMarkdown);
          }

          accumulated = attemptMarkdown;
          break;
        } catch (error) {
          const shouldRetry =
            attempt < ANALYZE_MAX_ATTEMPTS &&
            attemptMarkdown.length === 0 &&
            isRetryableLeaseAnalysisError(error);

          console.error(`Lease analysis attempt ${attempt} failed:`, error);

          if (!shouldRetry) {
            throw error;
          }

          await delay(ANALYZE_RETRY_DELAYS_MS[attempt - 1] ?? 3000);
          setStatus("uploading");
          setRawMarkdown("");
        }
      }

      if (!accumulated.trim()) {
        throw new Error("Lease analysis returned no content.");
      }

      console.log("[useLeaseAnalysis] Stream complete. Received", accumulated.length, "characters.");
      console.log("[useLeaseAnalysis] FULL MARKDOWN:\n", accumulated);

      // Once streaming is complete, parse the full markdown
      const parsed = parseReport(accumulated);
      setReport(parsed);
      setStatus("complete");

    } catch (err) {
      console.error("Analysis Error:", err);
      setError(formatLeaseAnalysisError(err));
      setStatus("error");
    }
  }, [documents, clientId]);

  return { 
    documents, 
    addDocuments, 
    removeDocument, 
    clearAll, 
    analyze, 
    status, 
    rawMarkdown, 
    report, 
    error,
    clientId
  };
}

function extractErrorMessage(payload: string) {
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {}

  return payload.trim();
}

function withStatus(error: Error, status: number) {
  return Object.assign(error, { status });
}

function isRetryableLeaseAnalysisError(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;
  const message = error instanceof Error ? error.message : String(error);

  return (
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    /network error|failed to fetch|fetch failed|connection error|timeout|socket hang up|econnreset/i.test(message)
  );
}

function formatLeaseAnalysisError(error: unknown) {
  const message = error instanceof Error ? error.message : "An error occurred during analysis.";

  if (isRetryableLeaseAnalysisError(error)) {
    return `Lease analysis failed after ${ANALYZE_MAX_ATTEMPTS} attempts due to a transient network/provider error. ${message}`;
  }

  return message;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
