import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());

app.post('/compress-pdf', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = path.join('uploads', `${req.file.filename}_compressed.pdf`);

  const ratio = Number(req.body.ratio);

  let pdfSetting = '/ebook';

  if (ratio >= 80) {
    pdfSetting = '/screen';
  } else if (ratio >= 50) {
    pdfSetting = '/ebook';
  } else {
    pdfSetting = '/printer';
  }

  execFile(
    'gs',
    [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${pdfSetting}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ],
    (error) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Ghostscript compression failed.');
      }

      res.download(outputPath, 'compressed.pdf', () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    }
  );
});

app.listen(3001, () => {
  console.log('Backend running on http://localhost:3001');
});