import { useState } from 'react';
import { ListRow, IconButton } from '@toss/tds-mobile';
import { getMeta, saveMeta } from '../lib/storage';

/**
 * 세금 시즌(1~5월) 안내 배너 — props 없는 자립형 컴포넌트.
 * 내부에서 AppMeta를 읽어 노출 여부를 판단하고, 닫으면 연 1회 재노출을 막는다.
 */
export function SeasonBanner() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [dismissedYear, setDismissedYear] = useState(
    () => getMeta()?.seasonBannerDismissedYear ?? null,
  );

  if (month < 1 || month > 5 || dismissedYear === year) return null;

  return (
    <ListRow
      contents={<ListRow.Texts type="1RowTypeA" top="지금은 연말정산·종소세 시즌이에요" />}
      right={
        <IconButton
          aria-label="배너 닫기"
          name="iconCloseRegular"
          onClick={() => {
            saveMeta({ seasonBannerDismissedYear: year });
            setDismissedYear(year);
          }}
        />
      }
    />
  );
}
