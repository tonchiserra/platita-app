"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { Box } from "@chakra-ui/react";

interface LazySectionProps {
  children: ReactNode;
  minHeight?: string;
  rootMargin?: string;
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

  if (visible) return <>{children}</>;

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
