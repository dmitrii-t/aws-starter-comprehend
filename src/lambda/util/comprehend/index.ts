import * as aws from 'aws-sdk';

export function asyncDetectSentiment(comprehend: aws.Comprehend, text: string, langCode: string = 'en'): Promise<any> {
  return new Promise((resolve, reject) => {
    const params = {
      LanguageCode: langCode,
      Text: text
    };
    comprehend.detectSentiment(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  })
}
