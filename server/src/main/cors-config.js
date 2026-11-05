const DEVELOPMENT_ORIGINS = [
  "http://localhost:1000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:9999",
  "http://localhost:9999",
];

export function createCorsOptions({
  nodeEnv = process.env.NODE_ENV,
  corsOrigins = process.env.CORS_ORIGINS,
} = {}) {
  const configuredOrigins = (corsOrigins || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

  if (nodeEnv === "production" && configuredOrigins.length === 0) {
    throw new Error("CORS_ORIGINS must include the deployed admin and client origins in production.");
  }

  return {
    origin: [
      ...new Set([
        ...configuredOrigins,
        ...(nodeEnv === "production" ? [] : DEVELOPMENT_ORIGINS),
      ]),
    ],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    optionsSuccessStatus: 204,
  };
}
