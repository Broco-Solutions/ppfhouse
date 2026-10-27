export default function QuotesLoading() {
  return (
    <div className="page-stack" aria-busy="true" role="status">
      <span className="sr-only">Cargando presupuestos</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-toolbar" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
    </div>
  );
}
