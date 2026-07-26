import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Button, ListRow, AlertDialog, Toast } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/StateView';
import { Amount } from '@/components/Amount';
import { AdSlot } from '@/components/AdSlot';
import { Sparkline } from '@/components/Sparkline';
import { getRecords, deleteRecord } from '@/lib/storage';
import { formatNumber } from '@/lib/utils';

const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? 'records-section';

const MAX_DISPLAY = 5;

export default function Records() {
  const navigate = useNavigate();
  const [allRecords, setAllRecords] = useState(() => getRecords());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, text: '' });
  const records = [...allRecords].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_DISPLAY);

  function handleConfirmDelete() {
    if (!deleteTargetId) return;
    deleteRecord(deleteTargetId);
    setAllRecords((prev) => prev.filter((record) => record.id !== deleteTargetId));
    setDeleteTargetId(null);
    setToast({ open: true, text: '기록을 삭제했어요' });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>기록 & 비교</Top.TitleParagraph>} />}
    >
      {records.length === 0 ? (
        <EmptyState
          title="저장된 기록이 없어요"
          description="결과를 저장하면 연도별 환급액을 비교해드려요"
          action={
            <Button variant="weak" onClick={() => navigate('/result')}>
              결과 저장하러 가기
            </Button>
          }
        />
      ) : (
        <>
          {records.length >= 2 &&
            (() => {
              const diff = records[0].result.refundAmount - records[1].result.refundAmount;
              const sign = diff >= 0 ? '+' : '-';
              return (
                <Card testId="record-diff-card">
                  <Paragraph.Text typography="st1">작년보다</Paragraph.Text>
                  <Spacing size={4} />
                  <span data-testid="record-diff">
                    <Paragraph.Text typography="t3">
                      {sign}
                      {formatNumber(Math.abs(diff))}원
                    </Paragraph.Text>
                  </span>
                </Card>
              );
            })()}

          <Spacing size={16} />

          {records.length >= 2 && (
            <>
              <Sparkline
                testId="trend-chart"
                data={[...records]
                  .sort((a, b) => a.taxYear - b.taxYear)
                  .map((record) => record.result.refundAmount)}
              />
              <Spacing size={16} />
            </>
          )}

          {records.length === 1 && (
            <>
              <Paragraph.Text typography="st13">
                비교하려면 다음 해 기록이 필요해요
              </Paragraph.Text>
              <Spacing size={16} />
            </>
          )}

          <AdSlot adGroupId={AD_GROUP_ID} />

          <Spacing size={16} />

          <Card>
            {records.map((record, i) => (
              <div key={record.id}>
                <ListRow
                  data-testid="record-item"
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={`${record.taxYear}년`}
                      bottom={<Amount value={record.result.refundAmount} unit="원" typography="st1" />}
                    />
                  }
                  right={
                    <Button
                      variant="weak"
                      size="small"
                      aria-label={`${record.taxYear}년 기록 삭제`}
                      onClick={() => setDeleteTargetId(record.id)}
                    >
                      삭제
                    </Button>
                  }
                />
                {i < records.length - 1 && <Spacing size={4} />}
              </div>
            ))}
          </Card>
        </>
      )}

      <Spacing size={80} />

      <AlertDialog
        open={deleteTargetId !== null}
        title="삭제할까요?"
        description="삭제한 기록은 되돌릴 수 없어요"
        alertButton={<AlertDialog.AlertButton onClick={handleConfirmDelete}>삭제</AlertDialog.AlertButton>}
        onClose={() => setDeleteTargetId(null)}
      />

      <Toast
        open={toast.open}
        text={toast.text}
        position="bottom"
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </ScreenScaffold>
  );
}
