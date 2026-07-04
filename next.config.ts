import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Context Detective route reads the skill + exemplar markdown at runtime
  // (docs/ is the git-versioned source of truth). Bundle those files into the
  // serverless function so they're present on Vercel.
  outputFileTracingIncludes: {
    "/api/context-answer": ["./docs/context_detective_skills_exemplars/**/*.md"],
  },
};

export default nextConfig;
