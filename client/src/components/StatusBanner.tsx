export function StatusBanner({
  tone,
  message
}: {
  tone: "success" | "error";
  message: string;
}) {
  return <div className={`notice ${tone}`}>{message}</div>;
}
