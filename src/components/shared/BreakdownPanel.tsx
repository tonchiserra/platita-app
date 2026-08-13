"use client";

import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { categoricalColor } from "@/lib/constants/colors";

export interface BreakdownItem {
  label: string;
  amount: number;
  percentage: number;
}

interface BreakdownPanelProps {
  title: string;
  items: BreakdownItem[];
  total: number;
  totalLabel: string;
  change?: number;
  /** For expenses, a rise is bad — flips which direction reads green. */
  invertChange?: boolean;
  palette: string[];
  emptyMessage: string;
  /** Optional glyph shown before each label. */
  iconFor?: (label: string) => string | undefined;
}

type View = "bars" | "pie";

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const options: { id: View; label: string; icon: React.ReactNode }[] = [
    {
      id: "bars",
      label: "Ver como barras",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="15" y2="12" />
          <line x1="4" y1="17" x2="10" y2="17" />
        </svg>
      ),
    },
    {
      id: "pie",
      label: "Ver como torta",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12A9 9 0 1 1 12 3v9z" />
        </svg>
      ),
    },
  ];

  return (
    <Flex gap="0" bg="bg.sunk" borderRadius="md" p="0.5" flexShrink={0}>
      {options.map((o) => (
        <Box
          as="button"
          key={o.id}
          aria-label={o.label}
          aria-pressed={view === o.id}
          onClick={() => onChange(o.id)}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          px="2"
          py="1"
          borderRadius="sm"
          cursor="pointer"
          bg={view === o.id ? "bg.card" : "transparent"}
          color={view === o.id ? "fg.heading" : "fg.muted"}
          boxShadow={view === o.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none"}
          _hover={{ color: "fg.heading" }}
          transition="color 0.14s, background 0.14s"
        >
          {o.icon}
        </Box>
      ))}
    </Flex>
  );
}

interface PieTooltipProps {
  active?: boolean;
  payload?: { payload: BreakdownItem }[];
  mask: (value: string) => string;
}

function PieTooltip({ active, payload, mask }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3">
      <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="1">
        {entry.label}
      </Text>
      <Text fontFamily="mono" fontSize="xs" color="fg.body" data-num>
        {mask(formatCurrency(entry.amount))} ({entry.percentage.toFixed(1).replace(".", ",")} %)
      </Text>
    </Box>
  );
}

/**
 * One ranked breakdown, two readings. Bars compare magnitudes directly; the
 * pie answers "what share of the whole". All rows share a single grid so every
 * bar track starts and ends on the same x — per-row grids drift with label width.
 */
export function BreakdownPanel({
  title,
  items,
  total,
  totalLabel,
  change,
  invertChange,
  palette,
  emptyMessage,
  iconFor,
}: BreakdownPanelProps) {
  const { mask } = useMoneyVisibility();
  const [view, setView] = useState<View>("bars");

  const max = items.length > 0 ? Math.max(...items.map((i) => i.amount)) : 0;
  const changeIsGood = change === undefined ? false : invertChange ? change < 0 : change >= 0;

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      p="6"
      h="full"
      display="flex"
      flexDirection="column"
    >
      <Flex align="center" justify="space-between" gap="3" mb="1">
        <Flex align="baseline" gap="2.5" minW="0">
          <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading" truncate>
            {title}
          </Text>
          {change !== undefined && (
            <Text
              fontFamily="mono"
              fontSize="sm"
              fontWeight="medium"
              color={changeIsGood ? "trend.up" : "trend.down"}
              flexShrink={0}
              data-num
            >
              {formatPercentage(change)}
            </Text>
          )}
        </Flex>
        {items.length > 0 && <ViewToggle view={view} onChange={setView} />}
      </Flex>

      {items.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py="12">
          {emptyMessage}
        </Text>
      ) : (
        <>
          <Text fontSize="xs" color="fg.muted" mb="4" fontFamily="mono" data-num>
            {mask(formatCurrency(total))} {totalLabel}
          </Text>

          {view === "bars" ? (
            <Box
              display="grid"
              gridTemplateColumns={{
                base: "minmax(0, 1fr) auto",
                sm: "auto minmax(40px, 1fr) auto auto",
              }}
              alignItems="center"
              columnGap="3"
            >
              {items.map((item, i) => {
                const cell = { paddingTop: "1.5", paddingBottom: "1.5" };
                return (
                  <Box key={item.label} display="contents">
                    <Flex align="center" gap="2" minW="0" {...cell}>
                      {iconFor?.(item.label) && (
                        <Text as="span" aria-hidden="true">
                          {iconFor(item.label)}
                        </Text>
                      )}
                      <Text fontSize="sm" color="fg.heading" truncate>
                        {item.label}
                      </Text>
                    </Flex>

                    <Box display={{ base: "none", sm: "block" }} {...cell}>
                      <Box h="6px" bg="bg.sunk" borderRadius="full" overflow="hidden">
                        <Box
                          h="full"
                          borderRadius="full"
                          bg={categoricalColor(palette, i)}
                          w={`${max > 0 ? (item.amount / max) * 100 : 0}%`}
                        />
                      </Box>
                    </Box>

                    <Box display={{ base: "none", sm: "block" }} textAlign="right" {...cell}>
                      <Text fontFamily="mono" fontSize="xs" color="fg.muted" data-num>
                        {item.percentage.toFixed(1).replace(".", ",")} %
                      </Text>
                    </Box>

                    <Box textAlign="right" {...cell}>
                      <Text
                        fontFamily="mono"
                        fontSize="sm"
                        color="fg.heading"
                        whiteSpace="nowrap"
                        data-num
                      >
                        {mask(formatCurrency(item.amount))}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <>
              <Box position="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={items}
                      dataKey="amount"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {items.map((_, i) => (
                        <Cell key={i} fill={categoricalColor(palette, i)} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip mask={mask} />} />
                  </PieChart>
                </ResponsiveContainer>
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  textAlign="center"
                  pointerEvents="none"
                >
                  <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="fg.heading" data-num>
                    {mask(formatCurrency(total))}
                  </Text>
                  <Text fontSize="2xs" color="fg.muted">
                    {totalLabel}
                  </Text>
                </Box>
              </Box>

              <Flex wrap="wrap" gap="3" mt="3" justify="center">
                {items.map((item, i) => (
                  <Flex key={item.label} align="center" gap="1.5">
                    <Box w="8px" h="8px" borderRadius="2px" bg={categoricalColor(palette, i)} flexShrink={0} />
                    <Text fontSize="xs" color="fg.body">
                      {item.label}{" "}
                      <Text as="span" fontFamily="mono" color="fg.muted" data-num>
                        {item.percentage.toFixed(0)} %
                      </Text>
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </>
          )}
        </>
      )}
    </Box>
  );
}
