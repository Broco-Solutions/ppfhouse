"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeSlashIcon,
  ImageIcon,
  StarIcon,
  XIcon,
} from "@phosphor-icons/react";
import Image from "next/image";
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  deletePhotoAction,
  movePhotoAction,
  setCoverPhotoAction,
  togglePhotoVisibilityAction,
  updatePhotoStageAction,
} from "@/modules/photos/application/actions";
import {
  photoStageLabels,
  photoStages,
} from "@/modules/photos/domain/photo-schema";

import styles from "./photo-gallery.module.css";

interface PhotoItem {
  id: string;
  isCover: boolean;
  stage: (typeof photoStages)[number] | null;
  visibleToClient: boolean;
}

export function PhotoGallery({
  jobId,
  photos,
}: {
  jobId: string;
  photos: PhotoItem[];
}) {
  if (!photos.length) {
    return (
      <div className={styles.empty}>
        <ImageIcon aria-hidden="true" size={26} weight="duotone" />
        <div>
          <strong>Sin fotos todavía</strong>
          <p>
            Las imágenes son privadas hasta que se publiquen explícitamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {photos.map((photo, index) => {
        const label = `Foto ${index + 1} del trabajo`;
        return (
          <article className={styles.card} key={photo.id}>
            <DialogTrigger>
              <AriaButton
                className={styles.frame}
                aria-label={`Ampliar ${label.toLowerCase()}`}
              >
                <Image
                  src={`/api/photos/${photo.id}/thumbnail`}
                  alt={label}
                  width={640}
                  height={640}
                  unoptimized
                  loading={index === 0 ? "eager" : "lazy"}
                />
                <span className={styles.zoom}>Ampliar</span>
                <span className={styles.badges}>
                  {photo.isCover ? <span>Portada</span> : null}
                  <span
                    className={
                      photo.visibleToClient ? styles.public : styles.private
                    }
                  >
                    {photo.visibleToClient ? "Visible al cliente" : "Privada"}
                  </span>
                </span>
              </AriaButton>
              <ModalOverlay className={styles.overlay} isDismissable>
                <Modal className={styles.modal}>
                  <Dialog className={styles.dialog}>
                    {({ close }) => (
                      <>
                        <div className={styles.lightboxHeader}>
                          <Heading slot="title">{label}</Heading>
                          <AriaButton
                            aria-label="Cerrar imagen"
                            className={styles.close}
                            onPress={close}
                          >
                            <XIcon aria-hidden="true" size={22} weight="bold" />
                          </AriaButton>
                        </div>
                        <Image
                          className={styles.preview}
                          src={`/api/photos/${photo.id}/preview`}
                          alt={label}
                          width={1600}
                          height={1200}
                          unoptimized
                        />
                      </>
                    )}
                  </Dialog>
                </Modal>
              </ModalOverlay>
            </DialogTrigger>

            <div className={styles.meta}>
              <form
                action={updatePhotoStageAction}
                className={styles.stageForm}
              >
                <input type="hidden" name="jobId" value={jobId} />
                <input type="hidden" name="photoId" value={photo.id} />
                <label>
                  <span>Etapa</span>
                  <select name="stage" defaultValue={photo.stage ?? ""}>
                    <option value="">Sin clasificar</option>
                    {photoStages.map((stage) => (
                      <option value={stage} key={stage}>
                        {photoStageLabels[stage]}
                      </option>
                    ))}
                  </select>
                </label>
                <button>Aplicar</button>
              </form>

              <div className={styles.actions}>
                <form action={togglePhotoVisibilityAction}>
                  <input type="hidden" name="jobId" value={jobId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <input
                    type="hidden"
                    name="visibleToClient"
                    value={photo.visibleToClient ? "false" : "true"}
                  />
                  <button
                    aria-label={
                      photo.visibleToClient
                        ? "Ocultar al cliente"
                        : "Publicar al cliente"
                    }
                  >
                    {photo.visibleToClient ? (
                      <EyeSlashIcon aria-hidden="true" />
                    ) : (
                      <EyeIcon aria-hidden="true" />
                    )}
                    <span>
                      {photo.visibleToClient ? "Ocultar" : "Publicar"}
                    </span>
                  </button>
                </form>
                {!photo.isCover ? (
                  <form action={setCoverPhotoAction}>
                    <input type="hidden" name="jobId" value={jobId} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <button aria-label="Usar como portada">
                      <StarIcon aria-hidden="true" />
                      <span>Portada</span>
                    </button>
                  </form>
                ) : null}
                <form action={movePhotoAction}>
                  <input type="hidden" name="jobId" value={jobId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <input type="hidden" name="direction" value="UP" />
                  <button aria-label="Mover foto antes" disabled={index === 0}>
                    <ArrowUpIcon aria-hidden="true" />
                  </button>
                </form>
                <form action={movePhotoAction}>
                  <input type="hidden" name="jobId" value={jobId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <input type="hidden" name="direction" value="DOWN" />
                  <button
                    aria-label="Mover foto después"
                    disabled={index === photos.length - 1}
                  >
                    <ArrowDownIcon aria-hidden="true" />
                  </button>
                </form>
                <form action={deletePhotoAction}>
                  <input type="hidden" name="jobId" value={jobId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <ConfirmButton
                    className={styles.delete}
                    message="¿Eliminar esta foto del trabajo?"
                  >
                    Eliminar
                  </ConfirmButton>
                </form>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
