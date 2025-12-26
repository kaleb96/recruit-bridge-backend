import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import puppeteer from 'puppeteer';

const fastify = Fastify({ logger: true });

// Swagger 플러그인 등록
await fastify.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Job & Rating API',
      description: '사람인 채용 공고와 잡플래닛 별점을 결합한 API 문서',
      version: '1.0.0',
    },
  },
});

// Swagger UI 플러그인 등록
await fastify.register(fastifySwaggerUi, {
  routePrefix: '/docs',
});

// 브라우저 설정 헬퍼
const getBrowser = () =>
  puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// API 정의
fastify.get(
  '/v1/test/saramin-domestic',
  {
    schema: {
      description:
        '서울 지역별 리스트 페이지에서 공고 개수와 목록을 추출합니다.',
      tags: ['Test'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', default: '1' },
        },
      },
    },
  },
  async (request, reply) => {
    const { page } = request.query;
    const browser = await puppeteer.launch({ headless: 'new' });
    const browserPage = await browser.newPage();

    // 브라우저 차단 방지용 설정
    await browserPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    try {
      const baseUrl = 'https://www.saramin.co.kr/zf_user/jobs/list/domestic';
      const params = new URLSearchParams({
        loc_mcd: '101000', // 서울 전체
        cat_kewd: '92', // 직무 카테고리
        panel_type: '',
        search_optional_item: 'n',
        search_done: 'y',
        panel_count: 'y',
        preview: 'y',
        page: page, // 페이지 번호 동적 적용
      });

      const targetUrl = `${baseUrl}?${params.toString()}`;
      fastify.log.info(`접속 URL: ${targetUrl}`);

      await browserPage.goto(targetUrl, { waitUntil: 'networkidle2' });

      // 데이터 추출
      const result = await browserPage.evaluate(() => {
        const totalCountText =
          document.querySelector('#sp_preview_total_cnt')?.innerText || '0';
        const totalCount = parseInt(totalCountText.replace(/[^0-9]/g, ''), 10);

        const items = Array.from(document.querySelectorAll('.list_item'));
        const jobs = items.map((item) => {
          // ID 추출 로직 (잘 하셨습니다!)
          const recIdx = item.id ? item.id.replace('rec-', '') : '';

          return {
            // .company_nm 안의 a 태그까지 접근해야 정확합니다.
            company:
              item.querySelector('.company_nm .str_tit')?.innerText.trim() ||
              '회사명 정보 없음',
            // a 태그의 title 속성 추출 (잘 하셨습니다!)
            title:
              item.querySelector('.job_tit a')?.getAttribute('title') ||
              '제목 정보 없음',
            location:
              item.querySelector('.work_place')?.innerText.trim() ||
              '장소 정보 없음',
            career:
              item.querySelector('.career')?.innerText.trim() ||
              '경력 정보 없음',
            date:
              item.querySelector('.date')?.innerText.trim() || '마감 정보 없음',
            link: `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${recIdx}`,
            recIdx: recIdx,
          };
        });
        return { totalCount, jobs };
      });
      return {
        success: true,
        totalCount: result.totalCount,
        count: result.jobs.length,
        date: result.jobs,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, message: error.message });
    } finally {
      await browser.close();
    }
  },
);

// 서버 실행
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log('🚀 API 문서 주소: http://localhost:3000/docs');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
