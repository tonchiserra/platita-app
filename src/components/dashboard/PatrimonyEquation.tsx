"use client";

import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

/** One factor in a term's multiplication chain, e.g. `× 95.400 USD`. */
export interface EquationFactor {
  value: string;
  unit?: string;
}

export interface EquationTerm {
  /** Leading operator. The first term carries none. */
  op?: "+" | "−";
  amount: string;
  unit?: string;
  /** Conversion chain, rendered as `× value unit`. */
  chain?: EquationFactor[];
  /** Plain-language tail, e.g. "ingresos de agosto". */
  note?: string;
}

interface PatrimonyEquationProps {
  terms: EquationTerm[];
  total: string;
  totalUnit?: string;
}

function Unit({ children }: { children: React.ReactNode }) {
  return (
    <Text
      as="span"
      fontFamily="body"
      fontSize="2xs"
      fontWeight="bold"
      letterSpacing="0.09em"
      color="fg.muted"
      position="relative"
      top="-1px"
    >
      {children}
    </Text>
  );
}

/**
 * Keyframes live in globals.css; the reduced-motion override there neutralises
 * this for anyone who asks for it.
 */
const settle = {
  animation: "platita-settle 0.42s cubic-bezier(0.2, 0.7, 0.3, 1) backwards",
};

function Row({
  term,
  masked,
  index,
}: {
  term: EquationTerm;
  masked: (v: string) => string;
  index: number;
}) {
  const delay = `${0.05 + index * 0.06}s`;

  return (
    <>
      <Text
        fontFamily="mono"
        fontSize="sm"
        color="fg.muted"
        textAlign="center"
        lineHeight="2.05"
        css={settle}
        animationDelay={delay}
      >
        {term.op ?? " "}
      </Text>
      <Flex
        wrap="wrap"
        align="baseline"
        gap="1.5"
        minW="0"
        fontFamily="mono"
        fontSize={{ base: "xs", md: "sm" }}
        lineHeight="2.05"
        css={settle}
        animationDelay={delay}
      >
        <Text as="span" fontWeight="medium" color="fg.heading">
          {masked(term.amount)}
        </Text>
        {term.unit && <Unit>{term.unit}</Unit>}
        {term.chain?.map((f, i) => (
          <Flex as="span" key={i} align="baseline" gap="1.5">
            <Text as="span" color="fg.muted" fontSize="xs">
              ×
            </Text>
            <Text as="span" color="fg.body">
              {f.value}
            </Text>
            {f.unit && <Unit>{f.unit}</Unit>}
          </Flex>
        ))}
        {term.note && (
          <Text as="span" fontFamily="body" fontSize="xs" color="fg.muted">
            {term.note}
          </Text>
        )}
      </Flex>
    </>
  );
}

/**
 * Net worth shown as the arithmetic that produces it. Collapsed by default:
 * this is a tool opened daily, so the detail earns its space only on demand.
 * A disclosure rather than a hover tooltip, because hover does not exist on
 * touch — which is how this app is mostly used.
 */
export function PatrimonyEquation({ terms, total, totalUnit }: PatrimonyEquationProps) {
  const { mask } = useMoneyVisibility();
  const [open, setOpen] = useState(false);

  return (
    <Box bg="bg.sunk" borderTop="1px solid" borderColor="border.card">
      <Flex
        as="button"
        w="full"
        align="center"
        gap="2"
        px={{ base: "4", md: "6" }}
        py="3"
        cursor="pointer"
        color="fg.muted"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        _hover={{ color: "fg.body", bg: "bg.hover" }}
        transition="color 0.14s, background 0.14s"
      >
        <Box
          as="span"
          display="inline-flex"
          transform={open ? "rotate(90deg)" : "none"}
          transition="transform 0.18s"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Box>
        <Text
          as="span"
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="0.13em"
          textTransform="uppercase"
        >
          Cómo se compone
        </Text>
      </Flex>

      {open && (
      <Box
        px={{ base: "4", md: "6" }}
        pb="5"
        display="grid"
        gridTemplateColumns="14px minmax(0, 1fr)"
        columnGap="3"
        alignItems="baseline"
        data-num
      >
        {terms.map((term, i) => (
          <Row key={i} term={term} masked={mask} index={i} />
        ))}

        <Box gridColumn="1 / -1" h="1px" bg="border.strong" my="2.5" />

        <Text fontFamily="mono" fontSize="sm" color="fg.heading" textAlign="center" lineHeight="2.05">
          =
        </Text>
        <Flex wrap="wrap" align="baseline" gap="1.5" fontFamily="mono" fontSize={{ base: "xs", md: "sm" }} lineHeight="2.05">
          <Text as="span" fontWeight="semibold" color="fg.heading">
            {mask(total)}
          </Text>
          {totalUnit && <Unit>{totalUnit}</Unit>}
        </Flex>
      </Box>
      )}
    </Box>
  );
}
