import { Job } from '../models/job.js';

export const runCollector = async (browserPage, category) => {
  const baseURL = 'https://www.saramin.co.kr/zf_user/jobs/list/domestic';

  // NOTE: 사람인에서 데이터 수집
  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      loc_mcd: '101000', // 서울 전체
      cat_kewd: category, // 직무 카테고리
      panel_type: '',
      search_optional_item: 'n',
      search_done: 'y',
      panel_count: 'y',
      preview: 'y',
      page: page, // 페이지 번호 동적 적용
    });
    const targetURL = `${baseURL}?${params.toString()}`;

    await browserPage.goto(targetURL, { waitUntil: 'networkidle2' });

    const jobs = await browserPage.evaluate(() => {
      return Array.from(document.querySelectorAll('.list_item'))
        .map((item) => ({
          recIdx: item.id ? item.id.replace('rec-', '') : '',
          company: item.querySelector('.company_nm .str_tit')?.innerText.trim(),
          title: item.querySelector('.job_tit a')?.getAttribute('title'),
          location: item.querySelector('.work_place')?.innerText.trim(),
          career: item.querySelector('.career')?.innerText.trim(),
          date: item.querySelector('.date')?.innerText.trim(),
          link: `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${item.id.replace(
            'rec-',
            '',
          )}`,
        }))
        .filter((j) => j.company);
    });

    // DB Upsert
    for (const job of jobs) {
      try {
        await Job.findOneAndUpdate(
          { recIdx: job.recIdx },
          { ...job, category },
          { upsert: true },
        );
      } catch (error) {
        console.error(`DB 저장 에러 (${job.company}):`, error.message);
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
};

export const updateStarRatings = async (browserPage) => {
  // 별점이 없는 데이터만 가져오기
  const companiesToUpdate = await Job.find({ star: null }).distinct('company');
  console.log(
    `🚀 총 ${companiesToUpdate.length}개의 기업 별점 수집을 시작합니다.`,
  );

  for (const companyName of companiesToUpdate) {
    if (!companyName) continue;

    // 검색어 정제
    const cleanTarget = companyName
      .replace(/\(주\)|주식회사|\(유\)/g, '')
      .trim();

    try {
      await browserPage.goto(
        `https://www.jobplanet.co.kr/search?query=${encodeURIComponent(
          cleanTarget,
        )}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 },
      );

      // 인자로 cleanTarget을 확실히 넘겨줍니다.
      const result = await browserPage.evaluate((target) => {
        const itKeywords = [
          'IT',
          '웹',
          '통신',
          '소프트웨어',
          '솔루션',
          '블록체인',
          'AI',
          '서비스',
          '플랫폼',
          '게임',
        ];

        // 선택자 확인
        const cards = Array.from(document.querySelectorAll('a.group.desktop'));
        if (cards.length === 0) return { star: -1, status: 'NOT_FOUND' };

        const matchedCard = cards.find((card) => {
          const h4 = card.querySelector('h4');
          if (!h4) return false;

          const jpName = h4.innerText
            .replace(/\(주\)|주식회사|\(유\)/g, '')
            .trim();
          const infoText =
            card.querySelector('.text-gray-400')?.innerText || '';

          // 이름 매칭 및 카테고리 매칭
          const nameMatch = jpName.includes(target) || target.includes(jpName);
          const categoryMatch = itKeywords.some((kw) => infoText.includes(kw));

          return nameMatch && categoryMatch;
        });

        if (matchedCard) {
          const starText =
            matchedCard.querySelector('.jp-star-solid')?.parentElement
              ?.nextElementSibling?.innerText;
          return { star: parseFloat(starText) || 0, status: 'MATCHED' };
        }
        return { star: -2, status: 'MISMATCHED' };
      }, cleanTarget); // <--- 외부의 cleanTarget을 내부의 target으로 전달

      // DB 업데이트
      await Job.updateMany(
        { company: companyName },
        { $set: { star: result.star, updatedAt: new Date() } },
      );

      console.log(
        `${companyName}: ${result.star} | status: [${result.status}]`,
      );
    } catch (error) {
      // 에러를 반드시 로그로 찍어야 원인 파악이 가능합니다.
      console.error(`${companyName} 처리 중 에러:`, error.message);
    }
    // 잡플래닛 차단 방지 딜레이
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('별점 업데이트 완료');
};
