export async function convertPdfToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64String = reader.result as string;
      // reader.result returns data:application/pdf;base64,... 
      // We just need the base64 payload for Anthropic API
      const base64Data = base64String.split(",")[1];
      if (base64Data) {
        resolve(base64Data);
      } else {
        reject(new Error("Failed to extract base64 data from file."));
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsDataURL(file);
  });
}
