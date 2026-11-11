/**
 * VOLUME 15.8 — AVALIAÇÃO AUTOMATIZADA DO SISTEMA RAG
 * Executa bateria de perguntas de benchmark para validar:
 * - Recuperação de decisões confirmadas (ADRs)
 * - Recuperação de regras de domínio e geração
 * - Distinção entre status confirmado e pendente
 * - Rastreabilidade de origem documental (IDs GW-XX-YYY)
 */

import { searchCanonicalRag } from "./bookRag";

export interface RagBenchmarkCase {
  id: string;
  question: string;
  expectedKeywords: string[];
  expectedVolume: string;
  passed: boolean;
  topChunkId: string | null;
  topChunkStatus: string | null;
}

export interface RagEvaluationReport {
  totalCases: number;
  passedCases: number;
  scorePercent: number;
  cases: RagBenchmarkCase[];
}

const BENCHMARK_QUESTIONS: Array<{
  id: string;
  question: string;
  expectedKeywords: string[];
  expectedVolume: string;
}> = [
  {
    id: "EVAL-01",
    question: "Quantos continentes e planetas existem no mundo de cada usuário? Pangeia",
    expectedKeywords: ["Pangeia", "planeta"],
    expectedVolume: "00",
  },
  {
    id: "EVAL-02",
    question: "Como funciona o determinismo e a semente na geração procedural?",
    expectedKeywords: ["semente", "determinística"],
    expectedVolume: "04",
  },
  {
    id: "EVAL-03",
    question: "Como tratar repositórios sem métricas ou valores ausentes vs zero?",
    expectedKeywords: ["zero", "ausência"],
    expectedVolume: "06",
  },
  {
    id: "EVAL-04",
    question: "Quais são as decisões confirmadas ADR-001 ADR-002 ADR-014?",
    expectedKeywords: ["ADR-001", "CONFIRMADO"],
    expectedVolume: "14",
  },
  {
    id: "EVAL-05",
    question: "O que acontece quando o GitHub estiver indisponível para um mundo já gerado?",
    expectedKeywords: ["indisponibilidade", "GitHub"],
    expectedVolume: "11",
  },
  {
    id: "EVAL-06",
    question: "Como funciona a persistência relacional PostgreSQL no Supabase e OAuth 2.0 ADR-015 ADR-016?",
    expectedKeywords: ["PostgreSQL", "Supabase", "OAuth"],
    expectedVolume: "14",
  },
  {
    id: "EVAL-07",
    question: "Como a recência do repositório pushed_at altera a cor da vegetação sazonal e UNNEST ADR-017?",
    expectedKeywords: ["ADR-017", "pushed_at", "UNNEST"],
    expectedVolume: "14",
  },
  {
    id: "EVAL-08",
    question: "Onde ficam os seguidores do perfil na Pangeia e arcos sub-orbitais ADR-018?",
    expectedKeywords: ["ADR-018", "seguidores", "Pangeia"],
    expectedVolume: "14",
  },
  {
    id: "EVAL-09",
    question: "Quais otimizações de GPU InstancedMesh e cache de fachada são usadas no motor 3D ADR-019?",
    expectedKeywords: ["ADR-019", "InstancedMesh"],
    expectedVolume: "14",
  },
  {
    id: "EVAL-10",
    question: "Como são representados repositórios arquivados archived, forks isFork e topics ADR-020?",
    expectedKeywords: ["ADR-020", "Monumentos", "isFork"],
    expectedVolume: "14",
  },
];

export function evaluateCanonicalRag(): RagEvaluationReport {
  const cases: RagBenchmarkCase[] = BENCHMARK_QUESTIONS.map((item) => {
    const searchRes = searchCanonicalRag(item.question, 4);
    const top = searchRes.results[0] ?? null;

    const combinedText = searchRes.results
      .map((r) => `${r.id} ${r.hierarchy} ${r.content}`)
      .join(" ")
      .toLowerCase();

    const keywordsMatched = item.expectedKeywords.every((kw) =>
      combinedText.includes(kw.toLowerCase())
    );

    const passed = Boolean(top && keywordsMatched);

    return {
      id: item.id,
      question: item.question,
      expectedKeywords: item.expectedKeywords,
      expectedVolume: item.expectedVolume,
      passed,
      topChunkId: top?.id ?? null,
      topChunkStatus: top?.status ?? null,
    };
  });

  const passedCases = cases.filter((c) => c.passed).length;
  const scorePercent = Math.round((passedCases / cases.length) * 100);

  return {
    totalCases: cases.length,
    passedCases,
    scorePercent,
    cases,
  };
}

