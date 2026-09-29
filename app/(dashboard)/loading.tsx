export default function DashboardLoading() {
  return <div className="pageLoading" role="status" aria-label="Loading page">
    <div className="routeLoadingBar" />
    <div className="loadingHeader">
      <div className="skeleton skeletonEyebrow" />
      <div className="skeleton skeletonTitle" />
      <div className="skeleton skeletonText" />
    </div>
    <div className="loadingMetrics">
      {Array.from({ length: 4 }, (_, index) => <div className="card loadingMetric" key={index}><div className="skeleton skeletonLabel" /><div className="skeleton skeletonValue" /><div className="skeleton skeletonMeta" /></div>)}
    </div>
    <div className="card loadingPanel">
      <div className="skeleton skeletonPanelTitle" />
      <div className="skeleton skeletonRow" />
      <div className="skeleton skeletonRow short" />
      <div className="skeleton skeletonRow" />
    </div>
    <span className="srOnly">Loading…</span>
  </div>;
}
