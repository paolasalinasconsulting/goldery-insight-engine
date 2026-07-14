import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useLocation } from "@tanstack/react-router";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Overview / Dashboard",
  "/share": "Fair Share",
  "/pareto": "Pareto por segmento",
  "/precios": "Precios",
  "/segmentos": "Segmentos",
  "/empaque": "Empaque",
  "/claims": "Claims",
  "/recomendacion": "Recomendación estratégica",
  "/base": "Base normalizada",
  "/configuracion": "Configuración",
  "/upload": "Carga de datos",
  "/mercadito": "Mercadito",
  "/exportar": "Exportar",
};

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const routeLabel = ROUTE_LABELS[location.pathname] ?? location.pathname;

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ route: routeLabel }),
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, messages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente IA"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full brand-gradient shadow-lg grid place-items-center text-white hover:scale-105 transition-transform"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border brand-gradient text-white">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-white/20 grid place-items-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">Asesor Category IQ</div>
                <div className="text-[10px] opacity-80">Viendo: {routeLabel}</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
              className="h-8 w-8 rounded-md hover:bg-white/10 grid place-items-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground space-y-3">
                <p>Hola 👋 Puedo ayudarte a interpretar tus análisis y sugerir acciones.</p>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Prueba preguntarme:</p>
                  {[
                    "¿Qué significa mi Fair Share negativo en 1000ml?",
                    "¿En qué segmento debería enfocarme primero?",
                    "¿Cómo interpreto el Pareto de esta categoría?",
                    "¿Qué acciones sugerirías con estos datos?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage({ text: q })}
                      className="block w-full text-left text-xs px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {isUser ? (
                      text
                    ) : (
                      <div className="space-y-2 [&_p]:leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="text-sm">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 text-sm">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 text-sm">{children}</ol>,
                            li: ({ children }) => <li className="leading-snug">{children}</li>,
                            strong: ({ children }) => <span className="font-semibold text-foreground">{children}</span>,
                            em: ({ children }) => <span className="italic">{children}</span>,
                            h1: ({ children }) => <div className="text-sm font-semibold mt-2">{children}</div>,
                            h2: ({ children }) => <div className="text-sm font-semibold mt-2">{children}</div>,
                            h3: ({ children }) => <div className="text-sm font-semibold mt-2">{children}</div>,
                            h4: ({ children }) => <div className="text-sm font-semibold mt-2">{children}</div>,
                            code: ({ children }) => (
                              <code className="text-xs bg-background/60 px-1 py-0.5 rounded">{children}</code>
                            ),
                            a: ({ children, href }) => (
                              <a href={href} target="_blank" rel="noreferrer" className="underline text-primary">
                                {children}
                              </a>
                            ),
                            hr: () => <hr className="my-2 border-border" />,
                          }}
                        >
                          {text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm">
                  Pensando…
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-destructive px-3 py-2 border border-destructive/30 rounded-md bg-destructive/5">
                Error: {error.message}
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 bg-card">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Pregunta sobre tu análisis…"
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 max-h-32"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label="Enviar"
                className="h-9 w-9 shrink-0 rounded-lg brand-gradient text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground text-center">
              Las respuestas son sugerencias; siempre valida con tus datos.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
