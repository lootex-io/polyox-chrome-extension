interface ErrorCardProps {
  message: string;
}

export default function ErrorCard({ message }: ErrorCardProps) {
  if (!message) return null;

  return (
    <div className="card error-card">
      <span className="error-text">{message}</span>
    </div>
  );
}
