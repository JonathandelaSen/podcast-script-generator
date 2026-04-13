"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BoltIcon,
  DatabaseIcon,
  InfoIcon,
  LoaderCircleIcon,
  TypeIcon,
  MicroscopeIcon,
  SparklesIcon,
  Trash2Icon,
  PlusCircleIcon,
} from "lucide-react";

import { createEpisodeAction } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SourceDraft = {
  id: string;
  label: string;
  rawText: string;
};

function createSourceDraft(index: number): SourceDraft {
  return {
    id: crypto.randomUUID(),
    label: `Source ${String(index + 1).padStart(2, "0")}`,
    rawText: "",
  };
}

export function NewEpisodeForm({
  variant = "standalone",
}: {
  variant?: "standalone" | "dialog";
}) {
  const [isPending, startTransition] = useTransition();
  const [episodeType, setEpisodeType] = useState<"summary" | "deep_dive">("summary");
  const [sources, setSources] = useState<SourceDraft[]>([
    createSourceDraft(0)
  ]);
  const [message, setMessage] = useState<string | null>(null);

  const filledCount = useMemo(
    () => sources.filter((source) => source.rawText.trim()).length,
    [sources]
  );

  return (
    <div className="mx-auto w-full py-6">
      <form
        className="flex flex-col gap-8"
        action={(formData) => {
          setMessage(null);
          sources.forEach((source) => {
            formData.append(
              "source",
              JSON.stringify({
                label: source.label.trim() || null,
                rawText: source.rawText,
              })
            );
          });

          startTransition(async () => {
            try {
              await createEpisodeAction(formData);
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "No se pudo crear el episodio."
              );
            }
          });
        }}
      >
        <div className="mb-4">
          <div className="flex items-center gap-2 text-primary font-semibold mb-2">
            <SparklesIcon className="size-4" />
            <span className="text-xs uppercase tracking-[0.1em]">New Episode Pipeline</span>
          </div>
          <h2 className="text-[2.5rem] font-bold text-foreground tracking-tight leading-tight">
            Architect Your Narrative
          </h2>
          <p className="text-muted-foreground text-lg mt-2 max-w-2xl">
            Define the core parameters and raw source materials for your next broadcast-quality script.
          </p>
        </div>

        <div className="space-y-8">
          <section className="bg-card p-8 rounded-xl border border-border/50 shadow-[0px_12px_32px_rgba(13,28,46,0.04)]">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                <TypeIcon className="size-4" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Core Definition</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold text-muted-foreground uppercase tracking-wider">
                  Topic
                </label>
                <input
                  name="topic"
                  required
                  className="w-full bg-transparent border-0 border-b border-border/40 focus:ring-0 focus:border-primary px-0 py-2 text-lg text-foreground placeholder:text-muted-foreground/40 transition-all outline-none"
                  placeholder="e.g. The Future of Neural Architecture"
                  type="text"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold text-muted-foreground uppercase tracking-wider">
                  Episode Type
                </label>
                <input type="hidden" name="episodeType" value={episodeType} />
                <div className="flex gap-4 pt-1">
                  <label className="flex-1 cursor-pointer group">
                    <input
                      checked={episodeType === "summary"}
                      onChange={() => setEpisodeType("summary")}
                      className="hidden peer"
                      type="radio"
                    />
                    <div className="border border-border/40 p-2.5 rounded-lg flex items-center justify-center gap-2 text-muted-foreground peer-checked:border-primary peer-checked:bg-primary-fixed peer-checked:text-primary transition-all">
                      <SparklesIcon className="size-4" />
                      <span className="text-sm font-medium">Summary</span>
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer group">
                    <input
                      checked={episodeType === "deep_dive"}
                      onChange={() => setEpisodeType("deep_dive")}
                      className="hidden peer"
                      type="radio"
                    />
                    <div className="border border-border/40 p-2.5 rounded-lg flex items-center justify-center gap-2 text-muted-foreground peer-checked:border-primary peer-checked:bg-primary-fixed peer-checked:text-primary transition-all">
                      <MicroscopeIcon className="size-4" />
                      <span className="text-sm font-medium">Deep Dive</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold text-muted-foreground uppercase tracking-wider">
                  Target Minutes
                </label>
                <div className="relative">
                  <input
                    name="targetMinutes"
                    type="number"
                    min={1}
                    max={240}
                    defaultValue={12}
                    required
                    className="w-full bg-transparent border-0 border-b border-border/40 focus:ring-0 focus:border-primary px-0 py-2 text-lg text-foreground transition-all outline-none pr-10"
                    placeholder="25"
                  />
                  <span className="absolute right-0 bottom-2.5 text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    MIN
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold text-muted-foreground uppercase tracking-wider">
                  Angle Hint
                </label>
                <input
                  name="angleHint"
                  className="w-full bg-transparent border-0 border-b border-border/40 focus:ring-0 focus:border-primary px-0 py-2 text-lg text-foreground placeholder:text-muted-foreground/40 transition-all outline-none"
                  placeholder="Provocative, contrarian perspective"
                  type="text"
                />
              </div>
            </div>
          </section>

          <section className="bg-muted p-8 rounded-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-foreground">
                <TypeIcon className="size-4" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Editorial Direction</h3>
            </div>
            <textarea
              name="editorialNotes"
              className="w-full bg-card border border-border/40 rounded-xl p-4 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
              placeholder="Describe the tone, desired takeaways, and any 'no-go' zones for the AI writer..."
              rows={4}
            />
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground">
                  <DatabaseIcon className="size-4" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Source Text</h3>
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest hidden sm:inline-block">
                1 - 5 Slots available
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {sources.map((source, index) => (
                <div
                  key={source.id}
                  className="group relative bg-card rounded-xl border border-border/50 p-6 focus-within:ring-2 focus-within:ring-primary/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-transparent group-focus-within:border-border/30 pb-2 transition-colors">
                    <div className="flex items-center gap-3 w-full">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded shrink-0">
                        Source {String(index + 1).padStart(2, "0")}
                      </span>
                      <input
                        value={source.label}
                        onChange={(e) =>
                          setSources((curr) =>
                            curr.map((item) =>
                              item.id === source.id ? { ...item, label: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Label (Optional)"
                        className="bg-transparent border-0 text-xs text-muted-foreground focus:text-foreground focus:ring-0 outline-none w-full"
                      />
                    </div>
                    {sources.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSources((curr) => curr.filter((item) => item.id !== source.id))
                        }
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1"
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={source.rawText}
                    onChange={(e) =>
                      setSources((curr) =>
                        curr.map((item) =>
                          item.id === source.id ? { ...item, rawText: e.target.value } : item
                        )
                      )
                    }
                    className="w-full bg-transparent border-0 focus:ring-0 p-0 text-foreground placeholder:text-muted-foreground/40 text-sm resize-none outline-none"
                    placeholder="Paste transcript, article text, or research notes here..."
                    rows={4}
                  />
                </div>
              ))}

              {sources.length < 5 && (
                <button
                  type="button"
                  onClick={() => setSources((curr) => [...curr, createSourceDraft(curr.length)])}
                  className="w-full py-4 border-2 border-dashed border-border/40 rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center gap-1"
                >
                  <PlusCircleIcon className="size-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Add Primary Source
                  </span>
                </button>
              )}
            </div>
          </section>

          {message && (
            <Alert variant="destructive">
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="pt-8 pb-12 flex flex-col md:flex-row items-center justify-between border-t border-border/30 gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground shrink-0">
                <InfoIcon className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground max-w-[200px] leading-snug">
                Estimating initial extraction based on {filledCount} active source(s).
              </p>
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <button
                type="button"
                className="hidden md:block px-8 py-3.5 text-sm font-semibold text-foreground hover:bg-accent rounded-xl transition-all"
              >
                Save Draft
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="w-full md:w-auto px-10 py-3.5 text-sm font-bold bg-gradient-to-br from-primary to-primary-container text-white rounded-xl shadow-[0px_8px_24px_rgba(53,37,205,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:pointer-events-none"
              >
                {isPending ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : null}
                Create Episode
                <BoltIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

