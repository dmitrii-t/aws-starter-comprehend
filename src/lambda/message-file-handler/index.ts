// Message File Handler
import aws = require('aws-sdk');
import crypto = require('crypto');
import { PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';

const KINESIS_PUT_RECORDS_BATCH_SIZE = 500;

const s3 = new aws.S3();
const kinesis = new aws.Kinesis();

/**
 * Lambda handler
 *
 * @param s3event
 * @param __
 */
export function handler(s3event: any, __: any) {
  console.info(`Message file handler is running with envs\n${JSON.stringify(process.env)}`);

  // Reads Env vars
  const streamName = process.env.message_stream as string;

  // Verifies file format is supported
  const s3obj: S3obj = resolveS3obj(s3event);
  if (s3obj.format != 'txt') throw new Error(`Illegal file format provided: ${s3obj.format}`);

  // Processes the file
  downloadS3obj(s3obj)
    .then((data: any) => {
      const body = data.Body;

      if (!(body instanceof Buffer)) throw new Error('S3 response body not a instanceof Buffer');

      const text = (body as Buffer).toString('utf8');
      return streamRecords(streamName, mapToDataStreamRecords(text));
    })
    .then((__) => {
      console.info(`Successfully processed file ${s3obj.key}`)
    })
    .catch((error: Error) => {
      console.error(`Fail to process file ${s3obj.key} with error\n${error}`)
    });
}

/**
 * Sprint text to lines and maps the lines to send to the data stream
 * @param text
 */
export const mapToDataStreamRecords = (text: string): PutRecordsRequestEntry[] => {
  const lines = text.split(/(?:\r\n|\r|\n)/g);

  // Formats lines to send to the data stream
  return lines
    .filter((line: string) => line.length > 0)
    .map((line: string) => {
      return {
        Data: line,
        // Generates partition keys
        PartitionKey: crypto.createHash('md5').update(line).digest('hex')
      } as PutRecordsRequestEntry
    });
};

/**
 * Sends records to the data stream
 *
 * @param streamName
 * @param records
 */
export const streamRecords = (streamName: string, records: PutRecordsRequestEntry[]): Promise<any> => {
  // Accumulates all tasks to put records
  const tasks: Promise<any>[] = [];

  while (records.length > 0) {
    const limit = Math.min(records.length, KINESIS_PUT_RECORDS_BATCH_SIZE);
    const batch = records.splice(0, limit);

    // Submits batch of records to the data stream
    const batchTask = new Promise((resolve, reject) => {
      kinesis.putRecords({StreamName: streamName, Records: batch}, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    tasks.push(batchTask)
  }

  // Consolidated promise
  return Promise.all(tasks)
};

export const resolveS3obj = (event: any): S3obj => {
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
};

const downloadS3obj = (s3obj: S3obj) => {
  return new Promise((resolve, reject) => {
    s3.getObject({Bucket: s3obj.bucket, Key: s3obj.key}, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  })
};

export interface S3obj {
  bucket: string
  format: string
  key: string
}
