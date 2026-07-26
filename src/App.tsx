import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Home from './pages/Home';
import Result from './pages/Result';
import Analysis from './pages/Analysis';
import Simulate from './pages/Simulate';
import Checklist from './pages/Checklist';
import Records from './pages/Records';
import { AppProviders } from './providers/AppProviders';
import { FloatingTabBar } from './components/FloatingTabBar';
import { TAB_ITEMS, TAB_ROOT_PATHS } from './routes';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

/**
 * 앱 진입 트리의 단일 소유자.
 * main.tsx(@AI:ANCHOR)의 BrowserRouter 안에서 전역 Provider(AppProviders)를 <Routes> 상위에
 * 정확히 한 번 감싸 모든 페이지에 컨텍스트를 공급하고, 탭-루트에서 FloatingTabBar를 렌더한다.
 */
export default function App() {
  const { pathname } = useLocation();
  const showTabBar = TAB_ROOT_PATHS.has(pathname);

  return (
    <AppProviders>
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
      {showTabBar && <FloatingTabBar items={TAB_ITEMS} />}
    </AppProviders>
  );
}
