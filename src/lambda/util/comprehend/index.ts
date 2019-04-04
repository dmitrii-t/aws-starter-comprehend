import * as aws from 'aws-sdk';

const client = new aws.Comprehend();

export function asyncDetectSentiment(text: string, langCode: string = 'en'): Promise<any> {
  return new Promise((resolve, reject) => {
    const params = {
      LanguageCode: langCode,
      Text: text
    };
    client.detectSentiment(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  })
}
