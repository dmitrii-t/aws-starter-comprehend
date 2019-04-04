import * as crypto from 'crypto';
import { PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';
import { DataRecord } from '../../model';
import * as KinesisUtil from '../../util/kinesis';

const CORS_HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
} as HttpHeaders;

interface PostFileRequest {
  name: string;
  type: string;
  data: string;
}

interface PostFileResponse {
  isBase64Encoded: boolean
  statusCode: number
  headers: HttpHeaders
  body?: string
}

interface HttpHeaders {
  [name: string]: string
}

export async function handler(httpEvent: any) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

  console.info(`File handler (${process.env['LAMBDA_TASK_ROOT']}) is running with envs\n${JSON.stringify(process.env)}`);

  // Reads Env vars
  const streamName = process.env.message_stream as string;

  // Reads request
  const file = JSON.parse(httpEvent['body']) as PostFileRequest;
  const text = new Buffer(file.data).toString('utf8');

  await KinesisUtil.asyncPutRecords(streamName, toDataRecords(text), toPutRecordsRequestEntries);
  console.info(`Successfully processed file ${file.name}`);

  // Success
  return {
    isBase64Encoded: false,
    statusCode: 200,
    headers: {...CORS_HTTP_HEADERS},
    body: ''
  };
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

