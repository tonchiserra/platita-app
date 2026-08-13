import { chakra } from "@chakra-ui/react";

export const Select = chakra("select", {
  base: {
    width: "full",
    height: "10",
    px: "3",
    pr: "8",
    bg: "bg.input",
    border: "1px solid",
    borderColor: "border.input",
    borderRadius: "l2",
    color: "fg.heading",
    fontSize: "sm",
    outline: "none",
    transition: "border-color 0.14s, box-shadow 0.14s",
    _hover: {
      borderColor: "border.strong",
    },
    _focusVisible: {
      borderColor: "cur.ars",
      boxShadow: "0 0 0 3px color-mix(in srgb, var(--chakra-colors-cur-ars) 22%, transparent)",
    },
  },
});
