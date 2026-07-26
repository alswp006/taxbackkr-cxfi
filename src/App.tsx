import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Home from './pages/Home';
import Result from './pages/Result';
import Analysis from './pages/Analysis';
import Simulate from './pages/Simulate';
import Checklist from './pages/Checklist';
import Records from './pages/Records';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/result" element={<Result />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="/simulate" element={<Simulate />} />
      <Route path="/checklist" element={<Checklist />} />
      <Route path="/records" element={<Records />} />
      {DevTdsGallery && (
        <Route
          path="/__tds-gallery"
          element={
            <Suspense fallback={null}>
              <DevTdsGallery />
            </Suspense>
          }
        />
      )}
      {/* 알 수 없는 경로는 홈으로 리다이렉트 (replace로 히스토리 오염 방지) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
