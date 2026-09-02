import { useState, useCallback } from "react";
import { AnalysisStatus, ContractDocument, ContractReport } from "@/lib/contract-analysis/types";
import { convertPdfToBase64 } from "@/lib/contract-analysis/pdf-to-base64";
import { parseReport } from "@/lib/contract-analysis/parse-report";
import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { resolveAgentModelId } from "@/lib/agent-model-provider";

export function useContractAnalysis(clientId?: string) {
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [rawMarkdown, setRawMarkdown] = useState("");
  const [report, setReport] = useState<ContractReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AgentAiProvider>("bedrock");
  const [lastModelId, setLastModelId] = useState<string | null>(null);

  const addDocuments = async (files: File[]) => {
    const pdfFiles = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));

    if (pdfFiles.length === 0) {
      setError("Only PDF files are accepted.");
      return;
    }

    if (documents.length + pdfFiles.length > 5) {
      setError("Maximum 5 documents per analysis.");
      return;
    }

    try {
      const newDocs: ContractDocument[] = [];

      for (const file of pdfFiles) {
        if (file.size > 32 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds 32MB limit.`);
        }

        if (documents.some((doc) => doc.name === file.name && doc.sizeBytes === file.size)) {
          continue;
        }

        const base64 = await convertPdfToBase64(file);
        newDocs.push({
          name: file.name,
          base64,
          mediaType: "application/pdf",
          sizeBytes: file.size,
        });
      }

      setDocuments((prev) => [...prev, ...newDocs]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process files.");
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => {
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
      setError("Please upload at least one contract document.");
      return;
    }

    setStatus("uploading");
    setRawMarkdown("");
    setReport(null);
    setError(null);

    try {
      const res = await fetch("/api/contract-analysis/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents,
          clientId,
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "API Request Failed");
      }

      if (!res.body) {
        throw new Error("No response body returned from API");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setRawMarkdown(accumulated);
        setStatus("streaming");
      }

      const parsed = parseReport(accumulated);
      setReport(parsed);
      setLastModelId(resolveAgentModelId(provider));
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during analysis.");
      setStatus("error");
    }
  }, [documents, clientId, provider]);

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
    clientId,
    provider,
    setProvider,
    lastModelId,
  };
}
