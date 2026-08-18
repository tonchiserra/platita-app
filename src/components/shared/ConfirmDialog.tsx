"use client";

import {
  DialogRoot,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  DialogActionTrigger,
  Button,
  Text,
} from "@chakra-ui/react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  /** Defaults to "Eliminar"; the styling stays destructive either way. */
  confirmLabel?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description = "Esta acción no se puede deshacer.",
  confirmLabel = "Eliminar",
}: ConfirmDialogProps) {
  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()} placement="center">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent
          bg="bg.card"
          border="1px solid"
          borderColor="border.card"
          borderRadius="xl"
          mx="4"
        >
          <DialogHeader>
            <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading">
              {title}
            </Text>
          </DialogHeader>
          <DialogBody>
            <Text fontSize="sm" color="fg.muted">
              {description}
            </Text>
          </DialogBody>
          <DialogFooter>
            <DialogActionTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancelar
              </Button>
            </DialogActionTrigger>
            <Button
              size="sm"
              bg="trend.down"
              color="white"
              borderRadius="l2"
              _hover={{ filter: "brightness(0.9)" }}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
