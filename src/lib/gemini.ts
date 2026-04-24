import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  type ArtifactPayloadByStage,
  type ArtifactStageKey,
  type Consolidation,
  type EpisodeBrief,
  type EpisodeOutline,
  type ScriptDraft,
  artifactSchemaByStage,
} from "@/lib/podcast";

const PROMPT_VERSION = "v1";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY. Añádela al entorno antes de generar contenido.",
    );
  }

  return new GoogleGenAI({ apiKey });
}

async function generateStructured<TStage extends ArtifactStageKey>(params: {
  model: string;
  stage: TStage;
  prompt: string;
}) {
  const client = getClient();
  const schema = artifactSchemaByStage[params.stage] as unknown as z.ZodSchema<
    ArtifactPayloadByStage[TStage]
  >;

  const response = await client.models.generateContent({
    model: params.model,
    contents: params.prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema),
      temperature: params.stage === "script" ? 0.7 : 0.3,
    },
  });

  const text = response.text;

  if (!text) {
    throw new Error("Gemini no devolvió texto en la respuesta.");
  }

  const parsed = JSON.parse(text);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    const issueSummary = result.error.issues
      .slice(0, 8)
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(
      `La respuesta de Gemini no encaja con el schema de ${params.stage}: ${issueSummary}`,
    );
  }

  return result.data;
}

function briefBlock(brief: EpisodeBrief) {
  return JSON.stringify(brief, null, 2);
}

function adjustmentRules(stage: ArtifactStageKey, sourceId?: string | null) {
  switch (stage) {
    case "extraction":
      return `
- Trabaja solo con la fuente incluida en el contexto.
- Respeta la instrucción del usuario sin inventar datos que no estén en rawText.
- sourceId debe ser exactamente "${sourceId ?? ""}".
- evidenceQuote debe seguir siendo una cita literal corta del texto fuente.
- importance debe ser un número entero JSON entre 1 y 5, nunca texto.
- Conserva los claims y mustKeep valiosos salvo que la instrucción pida retirarlos claramente.
`.trim();
    case "consolidation":
      return `
- Usa las extracciones aprobadas como única base factual.
- corePoints, secondaryPoints, contradictions y mustCoverClaimRefs deben referenciar claims existentes.
- Usa refs en formato "sourceId:claimId".
- Conserva el enfoque editorial salvo que la instrucción pida cambiarlo.
`.trim();
    case "outline":
      return `
- Usa la consolidación aprobada como base editorial.
- Mantén una estructura locutable y coherente con la duración objetivo.
- Los mustIncludeClaimRefs deben apuntar a claims presentes en la consolidación.
- Ajusta solo lo necesario para cumplir la instrucción.
`.trim();
    case "script":
      return `
- Usa extracciones, consolidación y outline aprobados como base factual.
- Devuelve un monólogo locutable en español.
- No inventes datos ni atribuyas certezas falsas.
- Conserva coveredClaimRefs que sigan cubiertos tras el ajuste y añade los nuevos refs cubiertos.
- Mantén scriptMarkdown limpio y bien estructurado en bloques.
`.trim();
    case "audit":
      return `
- Usa el guión y las fases aprobadas como base factual.
- Mantén una auditoría estricta: pass debe ser false si faltan mustKeep relevantes o hay soporte débil.
- score debe ir de 0 a 100.
- suggestedRepairs debe ser accionable para una nueva redacción.
`.trim();
  }
}

export async function adjustArtifact<TStage extends ArtifactStageKey>(params: {
  model: string;
  stage: TStage;
  brief: EpisodeBrief;
  currentArtifact: ArtifactPayloadByStage[TStage];
  instruction: string;
  context: unknown;
  sourceId?: string | null;
}) {
  const prompt = `
Eres un editor senior de podcast. Vas a ajustar una versión existente de una fase generada por IA siguiendo una instrucción del usuario.

Devuelve exclusivamente JSON válido y compatible con el mismo schema de la fase "${params.stage}".

Brief del episodio:
${briefBlock(params.brief)}

Contexto aprobado y material base:
${JSON.stringify(params.context, null, 2)}

Versión actual a ajustar:
${JSON.stringify(params.currentArtifact, null, 2)}

Instrucción del usuario:
${params.instruction}

Reglas generales:
- Aplica la instrucción de forma concreta.
- Mantén todo lo útil de la versión actual que no contradiga la instrucción.
- No cambies la forma del JSON ni añadas campos fuera del schema.
- Si la instrucción pide algo no soportado por el contexto factual, refleja la incertidumbre en los campos adecuados en vez de inventar.

Reglas de esta fase:
${adjustmentRules(params.stage, params.sourceId)}
`.trim();

  return generateStructured({
    model: params.model,
    stage: params.stage,
    prompt,
  });
}

export async function generateSourceExtraction(params: {
  model: string;
  brief: EpisodeBrief;
  source: {
    id: string;
    label: string | null;
    rawText: string;
  };
}) {
  const prompt = `
Eres un editor de podcast extremadamente cuidadoso con la cobertura factual.
Tu objetivo es NO perder nada importante de una única fuente escrita.

Devuelve exclusivamente JSON válido y compatible con el schema.

Brief del episodio:
${briefBlock(params.brief)}

Fuente:
${JSON.stringify(
    {
      sourceId: params.source.id,
      label: params.source.label,
      rawText: params.source.rawText,
    },
    null,
    2,
  )}

Reglas:
- Trabaja solo con la fuente dada.
- Los claims deben ser atómicos y concretos.
- evidenceQuote debe ser una cita literal corta del texto fuente.
- importance debe ser un número entero JSON entre 1 y 5, nunca texto.
- mustKeep debe incluir solo lo que sería grave perder en un episodio sobre este tema.
- Si hay sesgo, agenda o incertidumbre, señálalo sin dramatizar.
- sourceId debe ser exactamente "${params.source.id}".
`.trim();

  return generateStructured({
    model: params.model,
    stage: "extraction",
    prompt,
  });
}

type ConsolidationInput = {
  sourceId: string;
  sourceSummary: string;
  claims: Array<{
    ref: string;
    text: string;
    importance: number;
    kind: string;
    evidenceQuote: string;
  }>;
  notableDetails: string[];
  anecdotes: string[];
  uncertainties: string[];
  biasSignals: string[];
  mustKeep: Array<{ item: string; reason: string }>;
};

export async function generateConsolidation(params: {
  model: string;
  brief: EpisodeBrief;
  extractions: ConsolidationInput[];
}) {
  const prompt = `
Eres el editor jefe de un podcast monólogo.
Consolida varias extracciones aprobadas y decide el enfoque editorial sin inventar información.

Devuelve exclusivamente JSON válido y compatible con el schema.

Brief del episodio:
${briefBlock(params.brief)}

Extracciones aprobadas:
${JSON.stringify(params.extractions, null, 2)}

Reglas:
- corePoints y secondaryPoints deben referenciar claims con sourceClaimRefs.
- Usa refs en formato "sourceId:claimId".
- recommendedAngle debe ser específico y útil para escribir el guión.
- mustCoverClaimRefs debe incluir los claims que no deberían perderse en la redacción final.
- Si hay contradicciones, refléjalas con honestidad.
`.trim();

  return generateStructured({
    model: params.model,
    stage: "consolidation",
    prompt,
  });
}

export async function generateOutline(params: {
  model: string;
  brief: EpisodeBrief;
  consolidation: Consolidation;
}) {
  const prompt = `
Diseña el outline editorial de un episodio monólogo a partir de una consolidación ya aprobada.
Devuelve exclusivamente JSON válido y compatible con el schema.

Brief del episodio:
${briefBlock(params.brief)}

Consolidación aprobada:
${JSON.stringify(params.consolidation, null, 2)}

Reglas:
- Los bloques deben cubrir los mustCoverClaimRefs más importantes.
- targetMinutes por bloque debe ser realista y sumar aproximadamente la duración objetivo.
- El hook debe abrir el episodio con claridad.
- El cierre debe cerrar ideas, no solo despedirse.
`.trim();

  return generateStructured({
    model: params.model,
    stage: "outline",
    prompt,
  });
}

export async function generateScript(params: {
  model: string;
  brief: EpisodeBrief;
  extractions: ConsolidationInput[];
  consolidation: Consolidation;
  outline: EpisodeOutline;
}) {
  const prompt = `
Redacta un guión de podcast tipo monólogo en español.
Devuelve exclusivamente JSON válido y compatible con el schema.

Brief del episodio:
${briefBlock(params.brief)}

Extracciones aprobadas:
${JSON.stringify(params.extractions, null, 2)}

Consolidación aprobada:
${JSON.stringify(params.consolidation, null, 2)}

Outline aprobado:
${JSON.stringify(params.outline, null, 2)}

Reglas:
- El resultado debe ser un monólogo locutable y claro.
- Prioriza la cobertura fiel del contenido frente al estilo.
- No inventes datos ni atribuyas certezas falsas.
- Si algo es incierto, exprésalo con prudencia.
- scriptMarkdown debe venir limpio y bien estructurado en bloques.
- coveredClaimRefs debe incluir las referencias efectivamente cubiertas.
`.trim();

  return generateStructured({
    model: params.model,
    stage: "script",
    prompt,
  });
}

export async function generateAudit(params: {
  model: string;
  brief: EpisodeBrief;
  extractions: ConsolidationInput[];
  consolidation: Consolidation;
  outline: EpisodeOutline;
  script: ScriptDraft;
}) {
  const prompt = `
Audita un guión de podcast. Tu prioridad es detectar cobertura insuficiente o debilidad factual.
Devuelve exclusivamente JSON válido y compatible con el schema.

Brief del episodio:
${briefBlock(params.brief)}

Extracciones aprobadas:
${JSON.stringify(params.extractions, null, 2)}

Consolidación aprobada:
${JSON.stringify(params.consolidation, null, 2)}

Outline aprobado:
${JSON.stringify(params.outline, null, 2)}

Guión aprobado para auditoría:
${JSON.stringify(params.script, null, 2)}

Reglas:
- pass debe ser false si faltan elementos mustKeep relevantes o si el soporte factual es débil.
- score debe ir de 0 a 100.
- suggestedRepairs debe ser accionable para una nueva redacción.
- underusedSources debe listar sourceId cuando una fuente apenas influye.
`.trim();

  return generateStructured({
    model: params.model,
    stage: "audit",
    prompt,
  });
}

export function getPromptVersion() {
  return PROMPT_VERSION;
}
