import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    rules: {
      // setState inside useEffect is valid in React 18 (properly batched).
      // These are intentional patterns in the existing codebase.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
