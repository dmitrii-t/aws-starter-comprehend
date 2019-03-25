// File Handler
import * as aws from 'aws-sdk';
import * as crypto from 'crypto';
import { PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';
import { asyncGetObject, parseS3obj, S3obj } from '../util/s3';
import { asyncPutRecords } from '../util/kinesis';
import { DataRecord } from '../model';

const s3 = new aws.S3();
const kinesis = new aws.Kinesis();

/**
 * Lambda handler
 *
 * @param s3event
 * @param __
 */
export async function handler(s3event: any, __: any) {
  console.info(`File handler is running with envs\n${JSON.stringify(process.env)}`);

  // Reads Env vars
  const streamName = process.env.message_stream as string;

  // Verifies file format is supported
  const s3obj: S3obj = parseS3obj(s3event);
  if (s3obj.format != 'txt') throw new Error(`Illegal file format provided: ${s3obj.format}`);

  // Processes the file
  const data: any = await asyncGetObject(s3, s3obj);

  const body = data.Body;
  if (!(body instanceof Buffer)) throw new Error('S3 response body not a instanceof Buffer');

  const text = (body as Buffer).toString('utf8');
  await asyncPutRecords(kinesis, streamName, toDataRecords(text), toPutRecordsRequestEntries);
  console.info(`Successfully processed file ${s3obj.key}`)
}

/**
 * Sprint text to lines and maps the lines to send to the data stream
 * @param text
 */
export function toDataRecords(text: string): DataRecord[] {
  const lines = text.split(/(?:\r\n|\r|\n)/g);

  // Formats lines to send to the data stream
  return lines
    .filter((line: string) => line.length > 0)
    .map((text: string, lineNo: number) => ({text, lineNo} as DataRecord))
}

export function toPutRecordsRequestEntries(record: DataRecord): PutRecordsRequestEntry {
  const id = record.lineNo + '-' + record.text;
  return {
    Data: JSON.stringify(record),
    // Generates partition keys
    PartitionKey: crypto.createHash('md5').update(id).digest('hex')
  } as PutRecordsRequestEntry
}
