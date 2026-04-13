"use client";

import { useMemo, useState, useTransition } from "react";
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { createEpisodeAction } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SourceDraft = {
  id: string;
  label: string;
  rawText: string;
};

function createSourceDraft(index: number): SourceDraft {
  return {
    id: crypto.randomUUID(),
    label: `Fuente ${index + 1}`,
    rawText: "",
  };
}

export function NewEpisodeForm() {
  const [isPending, startTransition] = useTransition();
  const [episodeType, setEpisodeType] = useState<"summary" | "deep_dive">("summary");
  const [sources, setSources] = useState<SourceDraft[]>([
    createSourceDraft(0),
    createSourceDraft(1),
  ]);
  const [message, setMessage] = useState<string | null>(null);

  const filledCount = useMemo(
    () => sources.filter((source) => source.rawText.trim()).length,
    [sources],
  );

  return (
    <Card className="border-white/60 bg-white/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Nuevo episodio</CardTitle>
        <CardDescription>
          Pega entre 1 y 5 fuentes en texto plano y arranca un workspace editable por fases.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-5"
          action={(formData) => {
            setMessage(null);
            sources.forEach((source) => {
              formData.append(
                "source",
                JSON.stringify({
                  label: source.label.trim() || null,
                  rawText: source.rawText,
                }),
              );
            });

            startTransition(async () => {
              try {
                await createEpisodeAction(formData);
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "No se pudo crear el episodio.",
                );
              }
            });
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Topic</span>
              <Input name="topic" placeholder="Ej. El nuevo modelo GPT 5.5" required />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Tipo de episodio</span>
              <input type="hidden" name="episodeType" value={episodeType} />
              <Select value={episodeType} onValueChange={(value) => setEpisodeType(value as typeof episodeType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="summary">Resumen</SelectItem>
                    <SelectItem value="deep_dive">Deep dive</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Duración objetivo (minutos)</span>
              <Input
                name="targetMinutes"
                type="number"
                min={1}
                max={240}
                defaultValue={12}
                required
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Ángulo opcional</span>
              <Input name="angleHint" placeholder="Qué quieres enfatizar" />
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Notas editoriales</span>
            <Textarea
              name="editorialNotes"
              placeholder="Anécdotas, tono, límites, ideas que deberían aparecer..."
              className="min-h-28"
            />
          </label>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Fuentes</p>
              <p className="text-sm text-muted-foreground">
                {filledCount} de {sources.length} con texto.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSources((current) =>
                  current.length >= 5
                    ? current
                    : [...current, createSourceDraft(current.length)],
                )
              }
              disabled={sources.length >= 5 || isPending}
            >
              <PlusIcon data-icon="inline-start" />
              Añadir fuente
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {sources.map((source, index) => (
              <Card key={source.id} size="sm" className="border-border/70 bg-background/70">
                <CardHeader>
                  <CardTitle>Fuente {index + 1}</CardTitle>
                  <CardDescription>
                    Pega texto limpio. Puedes usar hilos de X, blogs o notas propias.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Input
                    value={source.label}
                    onChange={(event) =>
                      setSources((current) =>
                        current.map((item) =>
                          item.id === source.id
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder={`Fuente ${index + 1}`}
                  />
                  <Textarea
                    value={source.rawText}
                    onChange={(event) =>
                      setSources((current) =>
                        current.map((item) =>
                          item.id === source.id
                            ? { ...item, rawText: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Pega aquí el contenido de la fuente..."
                    className="min-h-48"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setSources((current) =>
                          current.length <= 1
                            ? current
                            : current.filter((item) => item.id !== source.id),
                        )
                      }
                      disabled={sources.length <= 1 || isPending}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {message ? (
            <Alert>
              <AlertTitle>Revisión necesaria</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : null}
              Crear episodio
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
