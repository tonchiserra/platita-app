"use client";

import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import type { Alert } from "@/lib/utils/alerts";

interface AlertsPanelProps {
  alerts: Alert[];
}

const VISIBLE = 3;

function LevelMark({ level, token }: { level: Alert["level"]; token?: string }) {
  const color = token ?? (level === "warn" ? "trend.down" : "fg.muted");
  return <Box w="3px" alignSelf="stretch" borderRadius="1px" bg={color} flexShrink={0} />;
}

/**
 * Things worth acting on, computed by comparing across screens the user would
 * otherwise have to check by hand. Renders nothing when there is nothing to
 * say — an always-present panel trains people to ignore it.
 */
export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

  const shown = expanded ? alerts : alerts.slice(0, VISIBLE);
  const hidden = alerts.length - shown.length;
  const warnings = alerts.filter((a) => a.level === "warn").length;

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" overflow="hidden">
      <Flex
        align="baseline"
        justify="space-between"
        gap="3"
        px={{ base: "4", md: "5" }}
        pt="4"
        pb="3"
      >
        <Text
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="0.13em"
          textTransform="uppercase"
          color="fg.muted"
        >
          Para tener en cuenta
        </Text>
        {warnings > 0 && (
          <Text fontFamily="mono" fontSize="xs" color="trend.down" data-num>
            {warnings} {warnings === 1 ? "aviso" : "avisos"}
          </Text>
        )}
      </Flex>

      <Flex direction="column">
        {shown.map((alert) => (
          <Flex
            key={alert.id}
            gap="3"
            px={{ base: "4", md: "5" }}
            py="3"
            borderTop="1px solid"
            borderColor="border.card"
          >
            <LevelMark level={alert.level} token={alert.token} />
            <Box minW="0">
              <Text fontSize="sm" fontWeight="medium" color="fg.heading">
                {alert.title}
              </Text>
              <Text fontSize="xs" color="fg.body" mt="0.5">
                {alert.detail}
              </Text>
            </Box>
          </Flex>
        ))}
      </Flex>

      {(hidden > 0 || expanded) && (
        <Box
          as="button"
          w="full"
          px={{ base: "4", md: "5" }}
          py="2.5"
          borderTop="1px solid"
          borderColor="border.card"
          cursor="pointer"
          color="fg.muted"
          textAlign="left"
          _hover={{ color: "fg.heading", bg: "bg.hover" }}
          transition="color 0.14s, background 0.14s"
          onClick={() => setExpanded((v) => !v)}
        >
          <Text fontSize="xs" fontWeight="medium">
            {expanded ? "Ver menos" : `Ver ${hidden} ${hidden === 1 ? "más" : "más"}`}
          </Text>
        </Box>
      )}
    </Box>
  );
}
