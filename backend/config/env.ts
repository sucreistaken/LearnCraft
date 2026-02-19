function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}. Check backend/.env`);
    process.exit(1);
  }
  return val;
}

export const env = {
  GEMINI_API_KEY: requireEnv("GEMINI_API_KEY"),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/learncraft",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-in-production",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  PORT: Number(process.env.PORT || 4000),
};
