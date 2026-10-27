"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  allowedPhotoMimeTypes,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_BATCH,
  photoStageLabels,
  photoStages,
} from "@/modules/photos/domain/photo-schema";

import styles from "./photo-uploader.module.css";

type UploadStatus = "ready" | "uploading" | "processing" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: UploadStatus;
  stage: (typeof photoStages)[number] | "";
  error?: string;
}

interface IntentResponse {
  intentId: string;
  uploadToken: string;
  uploadUrl: string;
  method: "POST" | "PUT";
  fields: Record<string, string>;
  headers: Record<string, string>;
  error?: string;
}

function uploadFile(
  url: string,
  method: "POST" | "PUT",
  fields: Record<string, string>,
  headers: Record<string, string>,
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    Object.entries(headers).forEach(([name, value]) =>
      request.setRequestHeader(name, value),
    );
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("UPLOAD_FAILED"));
    };
    request.onerror = () => reject(new Error("UPLOAD_FAILED"));
    if (method === "POST") {
      const body = new FormData();
      Object.entries(fields).forEach(([name, value]) =>
        body.append(name, value),
      );
      body.append("file", file);
      request.send(body);
      return;
    }
    request.send(file);
  });
}

export function PhotoUploader({ jobId }: { jobId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [batchError, setBatchError] = useState<string>();
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () =>
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)),
    [],
  );

  function update(id: string, values: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }

  function selectFiles(files: FileList | null) {
    if (!files) return;
    setBatchError(undefined);
    const incoming = Array.from(files).slice(0, MAX_PHOTOS_PER_BATCH);
    const valid = incoming.filter(
      (file) =>
        allowedPhotoMimeTypes.includes(file.type as never) &&
        file.size > 0 &&
        file.size <= MAX_PHOTO_BYTES,
    );
    if (files.length > MAX_PHOTOS_PER_BATCH || valid.length !== incoming.length)
      setBatchError(
        "Algunas imágenes se omitieron. Elegí hasta 10 JPG, PNG o WebP de 12 MB como máximo.",
      );
    setItems((current) => {
      current
        .filter((item) => item.status !== "done")
        .forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [
        ...current.filter((item) => item.status === "done"),
        ...valid.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          progress: 0,
          status: "ready" as const,
          stage: "" as const,
        })),
      ];
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runUpload(item: UploadItem) {
    update(item.id, { status: "uploading", progress: 0, error: undefined });
    try {
      const intentResponse = await fetch(`/api/jobs/${jobId}/photos/intents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: item.file.name,
          mimeType: item.file.type,
          sizeBytes: item.file.size,
        }),
      });
      const intent = (await intentResponse.json()) as IntentResponse;
      if (!intentResponse.ok)
        throw new Error(intent.error || "No pudimos preparar la carga.");
      await uploadFile(
        intent.uploadUrl,
        intent.method,
        intent.fields,
        intent.headers,
        item.file,
        (progress) => update(item.id, { progress }),
      );
      update(item.id, { status: "processing", progress: 100 });
      const confirmation = await fetch("/api/photos/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: intent.intentId,
          uploadToken: intent.uploadToken,
          stage: item.stage || null,
        }),
      });
      const result = (await confirmation.json()) as { error?: string };
      if (!confirmation.ok)
        throw new Error(result.error || "No pudimos procesar la imagen.");
      update(item.id, { status: "done" });
      return true;
    } catch (error) {
      update(item.id, {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "No pudimos cargar la imagen.",
      });
      return false;
    }
  }

  async function uploadPending() {
    const pending = items.filter(
      (item) => item.status === "ready" || item.status === "error",
    );
    const results = await Promise.all(pending.map(runUpload));
    if (results.some(Boolean)) router.refresh();
  }

  const busy = items.some(
    (item) => item.status === "uploading" || item.status === "processing",
  );
  const pending = items.some(
    (item) => item.status === "ready" || item.status === "error",
  );

  return (
    <div className={styles.uploader}>
      <label className={styles.picker}>
        <span>Elegir fotos</span>
        <small>JPG, PNG o WebP · hasta 10 por lote · 12 MB cada una</small>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => selectFiles(event.target.files)}
        />
      </label>
      {batchError ? (
        <p className="form-error" role="alert">
          {batchError}
        </p>
      ) : null}
      {items.length ? (
        <div className={styles.queue} aria-live="polite">
          {items.map((item) => (
            <article className={styles.item} key={item.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt="Previsualización local" />
              <div className={styles.itemBody}>
                <strong>{item.file.name}</strong>
                <small>{(item.file.size / 1024 / 1024).toFixed(1)} MB</small>
                <label className="field-group">
                  <span>Etapa opcional</span>
                  <select
                    value={item.stage}
                    disabled={
                      item.status !== "ready" && item.status !== "error"
                    }
                    onChange={(event) =>
                      update(item.id, {
                        stage: event.target.value as UploadItem["stage"],
                      })
                    }
                  >
                    <option value="">Sin clasificar</option>
                    {photoStages.map((stage) => (
                      <option value={stage} key={stage}>
                        {photoStageLabels[stage]}
                      </option>
                    ))}
                  </select>
                </label>
                {item.status === "uploading" || item.status === "processing" ? (
                  <progress value={item.progress} max={100}>
                    {item.progress}%
                  </progress>
                ) : null}
                <span
                  className={`${styles.status} ${item.status === "done" ? styles.done : ""} ${item.status === "error" ? styles.error : ""}`}
                >
                  {item.status === "ready"
                    ? "Lista para subir"
                    : item.status === "uploading"
                      ? `Subiendo ${item.progress}%`
                      : item.status === "processing"
                        ? "Generando variantes seguras…"
                        : item.status === "done"
                          ? "Cargada"
                          : item.error}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {pending ? (
        <button
          type="button"
          className="primary-button"
          onClick={uploadPending}
          disabled={busy}
        >
          {busy ? "Cargando…" : "Subir fotos"}
        </button>
      ) : null}
    </div>
  );
}
