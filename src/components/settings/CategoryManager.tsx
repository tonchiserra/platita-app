"use client";

import { useState } from "react";
import { Box, Button, Flex, Input, Text, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DEFAULT_CATEGORY_OPTIONS } from "@/lib/utils/expense-categories";
import type { ExpenseCategoryRow } from "@/types/database";

interface CategoryManagerProps {
  categories: ExpenseCategoryRow[];
}

export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const customised = categories.length > 0;

  /** Copies the built-in list into the user's own rows so it becomes editable. */
  const handleAdoptDefaults = async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("expense_categories").insert(
      DEFAULT_CATEGORY_OPTIONS.map((c, i) => ({
        user_id: user!.id,
        name: c.name,
        icon: c.icon,
        is_fixed: c.isFixed,
        sort_order: i,
      }))
    );

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.refresh();
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("expense_categories").insert({
      user_id: user!.id,
      name: (formData.get("name") as string).trim(),
      icon: ((formData.get("icon") as string) || "📌").trim(),
      is_fixed: formData.get("is_fixed") === "on",
      sort_order: categories.length,
    });

    setLoading(false);
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Ya tenés una categoría con ese nombre."
          : insertError.message
      );
      return;
    }
    setShowForm(false);
    router.refresh();
  };

  const handleSaveEdit = async (id: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("expense_categories")
      .update({
        name: (formData.get("name") as string).trim(),
        icon: ((formData.get("icon") as string) || "📌").trim(),
        is_fixed: formData.get("is_fixed") === "on",
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingId(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("expense_categories").delete().eq("id", id);
    router.refresh();
  };

  const inputProps = {
    bg: "bg.input",
    border: "1px solid",
    borderColor: "border.input",
    color: "fg.heading",
    _placeholder: { color: "fg.muted" },
  } as const;

  return (
    <VStack gap="4" align="stretch">
      <Flex justify="space-between" align="center" gap="3">
        <Box>
          <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading">
            Categorías de gastos
          </Text>
          <Text fontSize="xs" color="fg.muted" mt="0.5">
            Las que aparecen al cargar un gasto. Marcá como fijas las que se pagan una vez
            al mes, para que no se reproyecten al estimar el cierre.
          </Text>
        </Box>
        {customised && !showForm && (
          <Button
            size="sm"
            bg="brand.600"
            color="white"
            _hover={{ bg: "brand.500" }}
            onClick={() => setShowForm(true)}
            px="4"
            flexShrink={0}
          >
            + Agregar
          </Button>
        )}
      </Flex>

      {error && (
        <Text fontSize="sm" color="trend.down">
          {error}
        </Text>
      )}

      {!customised ? (
        <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="5">
          <Text fontSize="sm" color="fg.body" mb="3">
            Estás usando la lista que viene por defecto. Copiala a tu cuenta para renombrar,
            agregar o borrar categorías.
          </Text>
          <Flex wrap="wrap" gap="2" mb="4">
            {DEFAULT_CATEGORY_OPTIONS.map((c) => (
              <Flex
                key={c.name}
                align="center"
                gap="1.5"
                px="2.5"
                py="1"
                borderRadius="md"
                bg="bg.sunk"
              >
                <Text fontSize="sm" aria-hidden="true">
                  {c.icon}
                </Text>
                <Text fontSize="xs" color="fg.body">
                  {c.name}
                </Text>
              </Flex>
            ))}
          </Flex>
          <Button
            size="sm"
            bg="brand.600"
            color="white"
            _hover={{ bg: "brand.500" }}
            onClick={handleAdoptDefaults}
            loading={loading}
            px="4"
          >
            Personalizar categorías
          </Button>
        </Box>
      ) : (
        <>
          {showForm && (
            <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="5">
              <form onSubmit={handleAdd}>
                <VStack gap="3" align="stretch">
                  <Flex gap="3" wrap="wrap">
                    <Box w="72px">
                      <Text fontSize="xs" color="fg.body" mb="1">
                        Ícono
                      </Text>
                      <Input name="icon" placeholder="📌" maxLength={4} {...inputProps} />
                    </Box>
                    <Box flex="1" minW="160px">
                      <Text fontSize="xs" color="fg.body" mb="1">
                        Nombre
                      </Text>
                      <Input name="name" placeholder="Ej: Mascotas" required {...inputProps} />
                    </Box>
                  </Flex>
                  <Flex as="label" align="center" gap="2" cursor="pointer">
                    <input type="checkbox" name="is_fixed" />
                    <Text fontSize="sm" color="fg.body">
                      Es un gasto fijo mensual
                    </Text>
                  </Flex>
                  <Flex gap="2">
                    <Button
                      type="submit"
                      size="sm"
                      bg="brand.600"
                      color="white"
                      _hover={{ bg: "brand.500" }}
                      loading={loading}
                      px="4"
                    >
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      color="fg.body"
                      onClick={() => setShowForm(false)}
                      px="4"
                    >
                      Cancelar
                    </Button>
                  </Flex>
                </VStack>
              </form>
            </Box>
          )}

          <Box
            bg="bg.card"
            borderRadius="xl"
            border="1px solid"
            borderColor="border.card"
            overflow="hidden"
          >
            {categories.map((cat, i) => (
              <Box
                key={cat.id}
                px="5"
                py="3"
                borderBottom={i < categories.length - 1 ? "1px solid" : "none"}
                borderColor="border.card"
              >
                {editingId === cat.id ? (
                  <form onSubmit={(e) => handleSaveEdit(cat.id, e)}>
                    <Flex gap="3" wrap="wrap" align="flex-end">
                      <Box w="72px">
                        <Input name="icon" defaultValue={cat.icon} maxLength={4} {...inputProps} />
                      </Box>
                      <Box flex="1" minW="140px">
                        <Input name="name" defaultValue={cat.name} required {...inputProps} />
                      </Box>
                      <Flex as="label" align="center" gap="2" cursor="pointer" h="10">
                        <input type="checkbox" name="is_fixed" defaultChecked={cat.is_fixed} />
                        <Text fontSize="xs" color="fg.body">
                          Fijo
                        </Text>
                      </Flex>
                      <Flex gap="1">
                        <Button type="submit" size="xs" bg="brand.600" color="white" _hover={{ bg: "brand.500" }} px="3">
                          Guardar
                        </Button>
                        <Button size="xs" variant="ghost" color="fg.body" onClick={() => setEditingId(null)} px="3">
                          Cancelar
                        </Button>
                      </Flex>
                    </Flex>
                  </form>
                ) : (
                  <Flex align="center" justify="space-between" gap="3">
                    <Flex align="center" gap="3" minW="0">
                      <Text fontSize="lg" aria-hidden="true">
                        {cat.icon}
                      </Text>
                      <Text fontSize="sm" color="fg.heading" truncate>
                        {cat.name}
                      </Text>
                      {cat.is_fixed && (
                        <Text
                          fontSize="2xs"
                          fontWeight="semibold"
                          letterSpacing="0.08em"
                          textTransform="uppercase"
                          color="fg.muted"
                          bg="bg.sunk"
                          px="1.5"
                          py="0.5"
                          borderRadius="sm"
                          flexShrink={0}
                        >
                          Fijo
                        </Text>
                      )}
                    </Flex>
                    <Flex gap="1" flexShrink={0}>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="fg.muted"
                        _hover={{ color: "fg.heading" }}
                        aria-label={`Editar ${cat.name}`}
                        onClick={() => setEditingId(cat.id)}
                        px="2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="fg.muted"
                        _hover={{ color: "trend.down" }}
                        aria-label={`Eliminar ${cat.name}`}
                        onClick={() => setDeleteId(cat.id)}
                        px="2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </Button>
                    </Flex>
                  </Flex>
                )}
              </Box>
            ))}
          </Box>
        </>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Eliminar categoría"
        description="Los gastos ya cargados con esta categoría no se modifican; solo deja de aparecer al cargar uno nuevo."
      />
    </VStack>
  );
}
