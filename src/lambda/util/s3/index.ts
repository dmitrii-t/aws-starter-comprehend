import * as aws from 'aws-sdk';

/**
 * Resolves source txt file
 *
 * @param event
 */
export function parseS3obj(event: any): S3obj {
  const s3obj = event['Records'][0]['s3'];
  const bucket = s3obj['bucket']['name'];
  const key = s3obj['object']['key'];

  // const path = require('path');
  // const format = path.extname(key);
  const execResult = /\.(\w{3,4})$/.exec(key);
  const format = execResult && execResult.length > 1 ? execResult[1] : null;

  return {
    bucket,
    format,
    key
  } as S3obj
}

/**
 * Asynchronously downloads content of the file on s3
 *
 * @param s3
 * @param s3obj
 */
export function asyncGetObject(s3: aws.S3, s3obj: S3obj): Promise<any> {
  return new Promise((resolve, reject) => {
    s3.getObject({Bucket: s3obj.bucket, Key: s3obj.key}, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  })
}

export interface S3obj {
  bucket: string
  format: string
  key: string
}
