import { useState, useCallback } from "react";
import { AnalysisStatus, LeaseDocument, LeaseReport } from "@/lib/lease-analysis/types";
import { convertPdfToBase64 } from "@/lib/lease-analysis/pdf-to-base64";
import { parseReport } from "@/lib/lease-analysis/parse-report";

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
      const res = await fetch("/api/lease-analysis/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents, clientId }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "API Request Failed");
      }
      
      if (!res.body) {
        throw new Error("No response body returned from API");
      }

      console.log("[useLeaseAnalysis] Starting stream reader...");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      // Stream loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        
        // Update state with new chunks
        setRawMarkdown(accumulated);
      }

      console.log("[useLeaseAnalysis] Stream complete. Received", accumulated.length, "characters.");
      console.log("[useLeaseAnalysis] FULL MARKDOWN:\n", accumulated);

      // Once streaming is complete, parse the full markdown
      const parsed = parseReport(accumulated);
      setReport(parsed);
      setStatus("complete");

    } catch (err) {
      console.error("Analysis Error:", err);
      setError(err instanceof Error ? err.message : "An error occurred during analysis.");
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
