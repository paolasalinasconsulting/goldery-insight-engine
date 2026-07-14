import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `Eres un asesor estratégico de category management y marketing para "Category IQ by Goldery". Ayudas a interpretar análisis de share, Fair Share, Pareto, precios, segmentos, empaque, claims y recomendaciones.

Formato de respuesta (MUY IMPORTANT E):
- Escribe en prosa clara y breve, como un mensaje de chat.
- NO uses encabezados markdown (nada de #, ##, ###).
- NO abuses de negritas: como máximo 1-2 **términos clave** por respuesta, solo si aportan.
- Evita separadores (---), tablas y bloques de código salvo que se pidan explícitamente.
- Puedes usar listas con "- " cuando enumeres 3+ ítems; si son 1-2, escríbelos en la misma frase.
- Respuestas cortas (idealmente 3-6 frases). Si el tema es amplio, resume primero y ofrece profundizar.

Contenido:
- Español claro, cercano, sin jerga innecesaria.
- Cuando expliques un dato, di brevemente "qué significa" y "qué hacer".
- Si el usuario menciona una vista (Fair Share, Pareto, Precios, Segmentos, Empaque, Claims, Recomendación), interpreta desde esa lente.
- Si la marca tiene share total bajo (<3%), advierte del "espejismo de flechas verdes": superar el propio promedio es fácil; lo relevante es participar donde está el volumen.
- Prioriza acciones concretas: dónde entrar, qué presentación desarrollar, qué precio revisar, qué claim comunicar.
- Si falta contexto, pide lo mínimo necesario en una sola pregunta.`;

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
