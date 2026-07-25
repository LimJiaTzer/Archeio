import http from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

let upstream;
let app;
let encodedAttachment;

const binaryParser = (response, callback) => {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
};

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (body.includes(Buffer.from('fail.png'))) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Unreadable scan' }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      res.end(Buffer.from('PK\x03\x04docx'));
    });
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  process.env.OCR_PORT = String(upstream.address().port);
  ({ app, encodedAttachment } = await import('../server.js'));
});

afterAll(async () => {
  delete process.env.OCR_PORT;
  await new Promise((resolve) => upstream.close(resolve));
});

describe('Express conversion and OCR boundaries', () => {
  it('requires an uploaded file for OCR conversion', async () => {
    const response = await request(app).post('/convert/image-to-docx');
    expect(response.status).toBe(400);
    expect(response.text).toBe('No file uploaded.');
  });

  it('streams an OCR upload and returns a named DOCX response', async () => {
    const response = await request(app)
      .post('/convert/image-to-docx')
      .attach('file', Buffer.from('image'), {
        filename: 'lecture scan.png',
        contentType: 'image/png',
      })
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/,
    );
    expect(response.headers['content-disposition']).toContain('lecture scan.docx');
    expect(response.body.subarray(0, 4)).toEqual(Buffer.from('PK\x03\x04'));
  });

  it('forwards an upstream OCR validation error', async () => {
    const response = await request(app)
      .post('/convert/image-to-docx')
      .attach('file', Buffer.from('image'), {
        filename: 'fail.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(422);
    expect(JSON.parse(response.text)).toEqual({ detail: 'Unreadable scan' });
  });

  it('rejects unsupported document conversion formats', async () => {
    const response = await request(app)
      .post('/convert-to-pdf')
      .attach('file', Buffer.from('binary'), {
        filename: 'archive.bin',
        contentType: 'application/octet-stream',
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain('Unsupported format: .bin');
  });

  it('builds CRLF-safe Unicode attachment headers', () => {
    const header = encodedAttachment('../résumé\r\n.png');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9__.png");
  });
});
