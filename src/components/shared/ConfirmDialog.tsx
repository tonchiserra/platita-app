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
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description = "Esta acción no se puede deshacer.",
}: ConfirmDialogProps) {
  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()} placement="center">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent bg="bg.card" border="1px solid" borderColor="border.card" mx="4">
          <DialogHeader>
            <Text fontSize="lg" fontWeight="semibold" color="fg.heading">
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
              bg="red.500"
              color="white"
              _hover={{ bg: "red.600" }}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
