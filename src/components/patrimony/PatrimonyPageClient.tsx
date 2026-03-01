"use client";

import { useState, type ReactNode } from "react";
import { Button, Flex, Heading, VStack } from "@chakra-ui/react";
import { SnapshotForm } from "@/components/patrimony/SnapshotForm";
import { SnapshotTable } from "@/components/patrimony/SnapshotTable";
import type {
  Platform,
  ExchangeRates,
  PatrimonySnapshotFull,
} from "@/types/database";

interface PatrimonyPageClientProps {
  snapshots: PatrimonySnapshotFull[];
  platforms: Platform[];
  exchangeRates: ExchangeRates;
  children?: ReactNode;
}

export function PatrimonyPageClient({
  snapshots,
  platforms,
  exchangeRates,
  children,
}: PatrimonyPageClientProps) {
  const [editingSnapshot, setEditingSnapshot] =
    useState<PatrimonySnapshotFull | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const handleAdd = () => {
    setEditingSnapshot(null);
    setFormOpen(true);
  };

  const handleEdit = (snapshot: PatrimonySnapshotFull) => {
    setEditingSnapshot(snapshot);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingSnapshot(null);
  };

  return (
    <VStack gap="6" align="stretch">
      <Flex justify="space-between" align="center">
        <Heading size="lg" color="fg.heading">
          Patrimonio
        </Heading>
        {!formOpen && (
          <Button
            onClick={handleAdd}
            bg="brand.600"
            color="white"
            _hover={{ bg: "brand.500" }}
            size="sm"
            px="4"
          >
            + Agregar
          </Button>
        )}
      </Flex>
      {formOpen && (
        <SnapshotForm
          platforms={platforms}
          exchangeRates={exchangeRates}
          editingSnapshot={editingSnapshot}
          onClose={handleClose}
        />
      )}
      {children}
      <SnapshotTable
        snapshots={snapshots}
        onEdit={handleEdit}
      />
    </VStack>
  );
}
