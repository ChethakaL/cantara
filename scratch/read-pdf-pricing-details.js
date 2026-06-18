const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const dataBuffer = fs.readFileSync('/Users/chethaka/Bab Al Ilm AI/cantara-next/Cantara AI_Agents_Feedback.pdf');

async function run() {
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  let index = 0;
  while (true) {
    index = result.text.toLowerCase().indexOf('training', index);
    if (index === -1) break;
    console.log('--- FOUND TRAINING AT INDEX', index, '---');
    console.log(result.text.slice(index - 300, index + 500));
    index += 8;
  }
  await parser.destroy();
}

run().catch(console.error);
