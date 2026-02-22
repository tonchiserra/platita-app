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
    fontSize: "md",
    outline: "none",
    _focus: {
      borderColor: "brand.500",
    },
  },
});
