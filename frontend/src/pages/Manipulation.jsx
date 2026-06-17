// For cropping and resizing (Different from file compression)
// OCR / Conversion / Compression should link here if it is an IMAGE/VIDEO 
// Can add a 4th option for this page but for now, leave it as it is 

import { getFileInfo } from '../lib/fileTypes'; // file types
import React from 'react';
import Layout from '../components/Layout';

export default function Manipulation() {
  return (
    <Layout>
      <main>
        Elsa? Do you wanna build a snowman? ⛄
      </main>
    </Layout>
  );
}

