import Fastify from 'fastify';
import puppeteer from 'puppeteer';
import { connectDB } from './db.js';
// import { Job } from './models/job';

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { runCollector, updateStarRatings } from './services/crawler.js';

const fastify = Fastify({ logger: true });

// DB 연결
await connectDB();

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

// 1. 데이터 수집 트리거
fastify.get('/v1/collect', async (request, reply) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    // 사람인 데이터 수집
    fastify.log.info('Step 1: 사람인 데이터 수집 중...');
    await runCollector(page, '92');
    fastify.log.info('모든 작업이 완료되었습니다.');
  } catch (error) {
  } finally {
    await browser.close();
  }
});
// 별점 업데이트
fastify.get('/v1/updateStar', async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    // [잡플래닛 별점 업데이트
    fastify.log.info('Step 2: 잡플래닛 별점 업데이트 중...');
    await updateStarRatings(page);
    fastify.log.info('모든 작업이 완료되었습니다.');
  } catch (error) {
    fastify.log.error(`별점 업데이트 실패 ${error}`);
  }
});

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
