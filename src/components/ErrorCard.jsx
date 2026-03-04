export default function ErrorCard({ message }) {
  if (!message) return null;

  return (
    <div className="card error-card">
      <span className="error-text">{message}</span>
    </div>
  );
}
