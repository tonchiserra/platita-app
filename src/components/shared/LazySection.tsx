"use client";

import { createContext, useContext, useRef, useState, useEffect, type ReactNode, type Ref } from "react";
import { Box } from "@chakra-ui/react";

interface LazySectionProps {
  children: ReactNode;
  minHeight?: string;
  rootMargin?: string;
}

// The section's reserved height, for whatever renders inside it while its own
// code is still loading — see `SectionPlaceholder`.
const SectionHeight = createContext("200px");

function PlaceholderCard({ minHeight, ref }: { minHeight: string; ref?: Ref<HTMLDivElement> }) {
  return (
    <Box
      ref={ref}
      minH={minHeight}
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
    />
  );
}

/**
 * The same sized card `LazySection` shows before it is scrolled near, for a
 * code-split chart to show while its chunk downloads. Without it the section
 * collapsed to nothing between the two, and everything below it jumped.
 */
export function SectionPlaceholder() {
  return <PlaceholderCard minHeight={useContext(SectionHeight)} />;
}

export function LazySection({
  children,
  minHeight = "200px",
  rootMargin = "100px",
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  if (visible) return <SectionHeight value={minHeight}>{children}</SectionHeight>;

  return <PlaceholderCard ref={ref} minHeight={minHeight} />;
}
