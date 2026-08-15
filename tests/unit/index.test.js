import { jest } from '@jest/globals';

describe('index.js Component Tests', () => {
  let index;

  beforeAll(async () => {
    index = await import('../../scraper/index.js');
  });

  describe('transformJobsForSOLR', () => {
    it('should filter locations to only Romanian cities', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', location: ['România'] },
          { url: 'https://test.com/2', title: 'Job 2', location: ['Bucharest'] },
          { url: 'https://test.com/3', title: 'Job 3', location: ['Bulgaria'] },
          { url: 'https://test.com/4', title: 'Job 4', location: ['Cluj-Napoca'] },
          { url: 'https://test.com/5', title: 'Job 5', location: [] }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].location).toEqual(['România']);
      expect(result.jobs[1].location).toEqual(['Bucharest']);
      expect(result.jobs[2].location).toEqual(['România']);
      expect(result.jobs[3].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[4].location).toEqual(['România']);
    });

    it('should keep company uppercase', () => {
      const payload = {
        source: 'co-era.com',
        company: 'coera bc srl',
        cif: '32519996',
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', company: 'coera bc srl', cif: '32519996' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.company).toBe('COERA BC SRL');
    });

    it('should normalize workmode values', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', workmode: 'Remote' },
          { url: 'https://test.com/2', title: 'Job 2', workmode: 'ON-SITE' },
          { url: 'https://test.com/3', title: 'Job 3', workmode: 'Hybrid' },
          { url: 'https://test.com/4', title: 'Job 4', workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('on-site');
      expect(result.jobs[2].workmode).toBe('hybrid');
      expect(result.jobs[3].workmode).toBe('hybrid');
    });

    it('should handle empty jobs array', () => {
      const result = index.transformJobsForSOLR({ jobs: [] });
      expect(result.jobs).toEqual([]);
    });
  });

  describe('extractCities', () => {
    it('extracts cities from the location segment after the pipe', () => {
      const cities = index.extractCities('Go beyond for your role! | Cluj & Brasov');
      expect(cities).toContain('Cluj-Napoca');
      expect(cities).toContain('Brașov');
    });

    it('returns empty array when no pipe is present', () => {
      expect(index.extractCities('Go beyond for your role!')).toEqual([]);
    });

    it('normalizes non-diacritic spellings', () => {
      const cities = index.extractCities('Position | Bucuresti & Iasi');
      expect(cities).toContain('București');
      expect(cities).toContain('Iași');
    });
  });

  describe('mapToJobModel', () => {
    it('should map raw job to job model format', () => {
      const rawJob = {
        url: 'https://www.co-era.com/careers/go-beyond/',
        title: 'Go beyond for your role!',
        location: ['Cluj-Napoca', 'Brașov'],
        tags: ['Java', 'Spring'],
        workmode: 'hybrid'
      };

      const COMPANY_NAME = 'COERA BC SRL';
      const COMPANY_CIF = '32519996';

      const result = index.mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

      expect(result.url).toBe(rawJob.url);
      expect(result.title).toBe(rawJob.title);
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(COMPANY_CIF);
      expect(result.location).toEqual(rawJob.location);
      expect(result.tags).toEqual(rawJob.tags);
      expect(result.workmode).toBe(rawJob.workmode);
      expect(result.status).toBe('scraped');
      expect(result.date).toBeDefined();
    });

    it('should remove undefined fields', () => {
      const rawJob = {
        url: 'https://test.com/1',
        title: 'Job 1'
      };

      const result = index.mapToJobModel(rawJob, '32519996');

      expect(result.location).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.workmode).toBeUndefined();
    });

    it('should handle missing title', () => {
      const rawJob = { url: 'https://test.com/1' };

      const result = index.mapToJobModel(rawJob, '32519996');

      expect(result.title).toBeUndefined();
      expect(result.url).toBe('https://test.com/1');
    });
  });

  describe('parsePageJobs (COERA HTML scraping)', () => {
    const sampleHtml = `
      <a class="slot__anchor careerButton" href="/careers/summer-practice-program/" title="Summer Practice Program in Software Engineering | 2026">
        Summer Practice
      </a>
      <a class="slot__anchor careerButton" href="/careers/go-beyond/" title="Go beyond for your role! | Cluj & Brasov">
        Go beyond
      </a>
      <a class="careerButton" href="https://www.co-era.com/careers/full-link/" title="Already absolute URL test">
        Test
      </a>
    `;

    it('parses titles, stripping the trailing "| ..." segment', () => {
      const { jobs, total } = index.parsePageJobs(sampleHtml);
      expect(total).toBe(3);
      expect(jobs[0].title).toBe('Summer Practice Program in Software Engineering');
      expect(jobs[1].title).toBe('Go beyond for your role!');
      expect(jobs[2].title).toBe('Already absolute URL test');
    });

    it('builds absolute URLs from relative hrefs and keeps absolute ones', () => {
      const { jobs } = index.parsePageJobs(sampleHtml);
      expect(jobs[0].url).toBe('https://www.co-era.com/careers/summer-practice-program/');
      expect(jobs[2].url).toBe('https://www.co-era.com/careers/full-link/');
    });

    it('extracts cities from the title location segment', () => {
      const { jobs } = index.parsePageJobs(sampleHtml);
      expect(jobs[1].location).toContain('Cluj-Napoca');
      expect(jobs[1].location).toContain('Brașov');
    });

    it('falls back to defaultLocation when no city is in title', () => {
      const { jobs } = index.parsePageJobs(sampleHtml);
      expect(jobs[0].location).toEqual(['Cluj-Napoca']);
    });

    it('sets workmode to hybrid', () => {
      const { jobs } = index.parsePageJobs(sampleHtml);
      expect(jobs[0].workmode).toBe('hybrid');
    });

    it('returns empty when no .careerButton anchors are present', () => {
      const { jobs, total } = index.parsePageJobs('<html><body><a href="/x">no</a></body></html>');
      expect(jobs).toEqual([]);
      expect(total).toBe(0);
    });

    it('decodes HTML entities in titles', () => {
      const html = '<a class="careerButton" href="/careers/x/" title="Frontend &amp; Backend | Cluj">X</a>';
      const { jobs } = index.parsePageJobs(html);
      expect(jobs[0].title).toBe('Frontend & Backend');
    });
  });
});
