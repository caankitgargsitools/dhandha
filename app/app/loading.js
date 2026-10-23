// Shown while a page's data loads.
export default function Loading() {
  return <div className="page-loading" role="status"><span className="spinner" style={{ width: 22, height: 22 }} /><span>Loading…</span></div>;
}
