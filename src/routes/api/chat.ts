import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `Eres un asesor estratégico de category management y marketing para una plataforma llamada "Category IQ by Goldery". Ayudas a interpretar análisis de share, Fair Share, Pareto, precios, segmentos, empaque, claims y recomendaciones.

Estilo:
- Español claro, cercano, sin jerga innecesaria.
- Respuestas breves y accionables (usa listas cuando ayuden).
- Cuando expliques un dato, siempre di "qué significa" y "qué hacer".
- Si el usuario menciona una vista (Fair Share, Pareto, Precios, Segmentos, Empaque, Claims, Recomendación), interpreta desde esa lente.
- Cuando el share total de una marca sea bajo (<3%), advierte del "espejismo de flechas verdes": superar el propio promedio es fácil; lo relevante es participar donde está el volumen (PESO del segmento).
- Prioriza recomendaciones concretas: dónde entrar, qué presentación desarrollar, qué precio revisar, qué claim comunicar.
- Si te falta contexto de datos, pide lo mínimo necesario en una sola pregunta.`;

type ChatBody = { messages?: unknown; route?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3.5-flash");

        const routeHint = typeof body.route === "string" ? `\n\nEl usuario está viendo actualmente la vista: ${body.route}` : "";

        const result = streamText({
          model,
          system: SYSTEM_PROMPT + routeHint,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});
