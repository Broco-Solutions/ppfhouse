export default function FinanceLoading() {
  return (
    <div className="page-stack" aria-busy="true" role="status">
      <span className="sr-only">Cargando finanzas</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-panel" />
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
