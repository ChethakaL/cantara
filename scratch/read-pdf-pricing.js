const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const dataBuffer = fs.readFileSync('/Users/chethaka/Bab Al Ilm AI/cantara-next/Cantara AI_Agents_Feedback.pdf');

async function run() {
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  const lines = result.text.split('\n');
  let match = false;
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('pricing_analysis') || lines[i].includes('Competitive Pricing Analysis') || lines[i].includes('Pricing Analysis Agent')) {
      match = true;
      count = 0;
    }
    if (match) {
      console.log(lines[i]);
      count++;
      if (count > 40) {
        match = false;
        console.log('-------------------');
      }
    }
  }
  await parser.destroy();
}

run().catch(console.error);
