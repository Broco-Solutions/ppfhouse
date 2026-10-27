"use client";

import { XIcon } from "@phosphor-icons/react";
import Image from "next/image";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

import styles from "./portal.module.css";

export function PortalGallery({ photos }: { photos: { id: string }[] }) {
  return (
    <div className={styles.photoGrid}>
      {photos.map((photo, index) => {
        const label = `Foto ${index + 1} del trabajo`;
        return (
          <DialogTrigger key={photo.id}>
            <Button
              className={styles.photoButton}
              aria-label={`Ampliar ${label.toLowerCase()}`}
            >
              <Image
                src={`/api/client/photos/${photo.id}/thumbnail`}
                alt={label}
                width={640}
                height={480}
                unoptimized
                loading={index === 0 ? "eager" : "lazy"}
              />
            </Button>
            <ModalOverlay className={styles.overlay} isDismissable>
              <Modal className={styles.modal}>
                <Dialog className={styles.dialog}>
                  {({ close }) => (
                    <>
                      <div className={styles.dialogHeader}>
                        <Heading slot="title">{label}</Heading>
                        <Button aria-label="Cerrar imagen" onPress={close}>
                          <XIcon aria-hidden="true" size={22} />
                        </Button>
                      </div>
                      <Image
                        className={styles.preview}
                        src={`/api/client/photos/${photo.id}/preview`}
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
        );
      })}
    </div>
  );
}
