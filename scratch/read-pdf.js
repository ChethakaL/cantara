const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const dataBuffer = fs.readFileSync('/Users/chethaka/Bab Al Ilm AI/cantara-next/Cantara AI_Agents_Feedback.pdf');

async function run() {
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  console.log(result.text);
  await parser.destroy();
}

run().catch(console.error);
