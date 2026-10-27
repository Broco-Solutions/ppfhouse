export default function JobsLoading() {
  return (
    <div className="page-stack" aria-busy="true" role="status">
      <span className="sr-only">Cargando trabajos</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-toolbar" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
    </div>
  );
}
