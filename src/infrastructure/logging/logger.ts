type LogLevel = "info" | "warn" | "error";
type SafeContext = Record<string, boolean | number | string | null | undefined>;

function write(level: LogLevel, message: string, context: SafeContext = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

export const logger = {
  info: (message: string, context?: SafeContext) =>
    write("info", message, context),
  warn: (message: string, context?: SafeContext) =>
    write("warn", message, context),
  error: (message: string, context?: SafeContext) =>
    write("error", message, context),
};
