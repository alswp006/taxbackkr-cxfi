import { useEffect, useState } from 'react';
import { Top, Paragraph, Spacing, Button, ListRow, Toast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { SummaryHero } from '@/components/SummaryHero';
import { Amount } from '@/components/Amount';
import { getProfile, getDeductions, saveDeductions } from '@/lib/storage';
import { calcTax } from '@/lib/calc';
import { formatNumber } from '@/lib/utils';
import type { Deductions, TaxProfile } from '@/lib/types';

const DEDUCTION_MAX = 100_000_000; // 1억
const DEBOUNCE_MS = 250;

const SLIDER_ITEMS: { key: keyof Deductions; label: string }[] = [
  { key: 'creditCard', label: '신용카드' },
  { key: 'medical', label: '의료비' },
  { key: 'education', label: '교육비' },
  { key: 'irp', label: 'IRP' },
  { key: 'insurance', label: '보험료' },
  { key: 'donation', label: '기부금' },
];

const TAB_ITEMS = [
  { label: '홈', path: '/' },
  { label: '체크리스트', path: '/checklist' },
  { label: '기록', path: '/records' },
];

const FALLBACK_PROFILE: TaxProfile = {
  id: '',
  taxYear: new Date().getFullYear(),
  incomeType: 'employee',
  annualSalary: 0,
  freelanceIncome: 0,
  dependents: 0,
  updatedAt: 0,
};

const FALLBACK_DEDUCTIONS: Deductions = {
  creditCard: 0,
  medical: 0,
  education: 0,
  irp: 0,
  insurance: 0,
  donation: 0,
};

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export default function Simulate() {
  const profile = getProfile() ?? FALLBACK_PROFILE;
  const initialDeductions = getDeductions() ?? FALLBACK_DEDUCTIONS;

  // draft: 슬라이더 즉시 표시값. debounced: calcTax 재계산에 쓰이는 지연 반영값.
  const [draft, setDraft] = useState<Deductions>(initialDeductions);
  const [debounced, setDebounced] = useState<Deductions>(initialDeductions);
  const [toast, setToast] = useState({ open: false, text: '' });

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  const result = calcTax(profile, debounced);

  function handleSliderChange(key: keyof Deductions, rawValue: number) {
    const clamped = Math.min(Math.max(0, rawValue), DEDUCTION_MAX);
    fireHaptic('tickWeak');
    setDraft((prev) => ({ ...prev, [key]: clamped }));
  }

  function handleSave() {
    saveDeductions(draft);
    fireHaptic('success');
    setToast({ open: true, text: '공제 내역을 저장했어요' });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>공제 시뮬레이션</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TAB_ITEMS} />}
    >
      <SummaryHero
        testId="sim-hero"
        label="예상 환급액"
        value={<Amount value={result.refundAmount} unit="원" typography="t2" />}
      />

      <Spacing size={16} />

      {SLIDER_ITEMS.map(({ key, label }) => (
        <div key={key}>
          <ListRow
            contents={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Paragraph.Text typography="st1">{label}</Paragraph.Text>
                  <Paragraph.Text typography="st1">{formatNumber(draft[key])}원</Paragraph.Text>
                </div>
                <input
                  type="range"
                  data-testid={`deduction-slider-${key}`}
                  aria-label={`${label} 슬라이더`}
                  min={0}
                  max={DEDUCTION_MAX}
                  step={10000}
                  value={draft[key]}
                  onChange={(e) => handleSliderChange(key, Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--adaptiveBlue500)' }}
                />
              </div>
            }
          />
          <Spacing size={8} />
        </div>
      ))}

      <Spacing size={16} />

      <Button variant="fill" display="block" onClick={handleSave}>
        이 값으로 저장
      </Button>

      <Spacing size={16} />

      <Paragraph.Text typography="st13">참고용 추정치예요</Paragraph.Text>

      <Spacing size={80} />

      <Toast
        open={toast.open}
        text={toast.text}
        position="bottom"
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </ScreenScaffold>
  );
}
