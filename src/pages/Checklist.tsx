import { useState } from 'react';
import { Top, Paragraph, Spacing, Badge, BottomSheet, ListRow } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { MiniBar } from '@/components/MiniBar';
import { getDeductions } from '@/lib/storage';
import { deriveChecklist } from '@/lib/checklist';
import { DEDUCTION_TIPS } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';
import type { ChecklistKey, Deductions } from '@/lib/types';

/** ChecklistKey → Deductions 키 매핑 (팁 조회용, checklist.ts의 CHECKLIST_SOURCE와 동일) */
const CHECKLIST_SOURCE: Record<ChecklistKey, keyof Deductions> = {
  irp: 'irp',
  pension: 'insurance',
  medical: 'medical',
  creditCard: 'creditCard',
  donation: 'donation',
  housing: 'education',
};

const FALLBACK_DEDUCTIONS: Deductions = {
  creditCard: 0,
  medical: 0,
  education: 0,
  irp: 0,
  insurance: 0,
  donation: 0,
};

function fireHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export default function Checklist() {
  const deductions = getDeductions() ?? FALLBACK_DEDUCTIONS;
  const checklist = deriveChecklist(deductions);
  const [openKey, setOpenKey] = useState<ChecklistKey | null>(null);

  function handleOpenTip(key: ChecklistKey) {
    fireHaptic();
    setOpenKey(key);
  }

  const openItem = checklist.items.find((item) => item.key === openKey) ?? null;
  const openTip = openItem ? DEDUCTION_TIPS[CHECKLIST_SOURCE[openItem.key]] : null;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>절세 체크리스트</Top.TitleParagraph>} />}
    >
      <div data-testid="checklist-progress">
        <Paragraph.Text typography="t3">
          <span>{checklist.achievedCount}/6</span> 달성
        </Paragraph.Text>
        <Spacing size={8} />
        <MiniBar ratio={checklist.achievedCount / checklist.totalCount} />
      </div>

      <Spacing size={16} />

      {checklist.items.map((item) => (
        <div key={item.key}>
          <ListRow
            data-testid={`checklist-item-${item.key}`}
            onClick={() => handleOpenTip(item.key)}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <Paragraph.Text typography="st1">{item.label}</Paragraph.Text>
                    {item.done && (
                      <Badge size="small" variant="fill" color="blue">
                        완료
                      </Badge>
                    )}
                  </div>
                }
                bottom={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Paragraph.Text typography="st3">
                      {formatNumber(item.currentAmount)}원 / {formatNumber(item.targetAmount)}원
                    </Paragraph.Text>
                    <MiniBar ratio={item.targetAmount > 0 ? item.currentAmount / item.targetAmount : 0} />
                  </div>
                }
              />
            }
          />
          <Spacing size={4} />
        </div>
      ))}

      <Spacing size={80} />

      <BottomSheet open={openItem !== null} onClose={() => setOpenKey(null)} header={openItem?.label}>
        <Paragraph.Text typography="st1">{openTip}</Paragraph.Text>
        <Spacing size={8} />
        <Paragraph.Text typography="st13">참고용 정보예요</Paragraph.Text>
      </BottomSheet>
    </ScreenScaffold>
  );
}
