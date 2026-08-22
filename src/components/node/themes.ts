export const NODE_THEMES = {
  agent: {
    accent: "#3b82f6",
    border: "#60a5fa",
    soft: "rgba(59, 130, 246, 0.12)",
  },
  tool: {
    accent: "#a855f7",
    border: "#c084fc",
    soft: "rgba(168, 85, 247, 0.12)",
  },
  input: {
    accent: "#f59e0b",
    border: "#fbbf24",
    soft: "rgba(245, 158, 11, 0.12)",
  },
  vectorDB: {
    accent: "#10b981",
    border: "#34d399",
    soft: "rgba(16, 185, 129, 0.12)",
  },
  embeddingModel: {
    accent: "#06b6d4",
    border: "#22d3ee",
    soft: "rgba(6, 182, 212, 0.12)",
  },
  subAgent: {
    accent: "#ec4899",
    border: "#f472b6",
    soft: "rgba(236, 72, 153, 0.12)",
  },
  model: {
    accent: "#6366f1",
    border: "#818cf8",
    soft: "rgba(99, 102, 241, 0.12)",
  },
} as const;

export type NodeTheme = (typeof NODE_THEMES)[keyof typeof NODE_THEMES];

/** Shared node-state and handle colors. */
export const THEME = {
  active: "#22c55e",
  idle: "#64748b",
  inputHandle: "#3b82f6",
  outputHandle: "#10b981",
  toolHandle: "#a855f7",
} as const;
