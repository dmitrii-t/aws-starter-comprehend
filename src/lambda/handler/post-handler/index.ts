import { createHash } from 'crypto';
import { PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';
import { TextLine } from '../../model';
import * as AwsKinesisUtil from '../../util/aws/kinesis';
import { decodeBase64 } from '../../util/base64.util';

const CORS_HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
} as HttpHeaders;

interface PostRequest {
  client: string;
  text: string;
}

interface PostResponse {
  isBase64Encoded: boolean
  statusCode: number
  headers: HttpHeaders
  body?: string
}

interface HttpHeaders {
  [name: string]: string
}

export async function post(postEvent: any) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];
  console.info(`Post handler (${process.env['LAMBDA_TASK_ROOT']}) is running with envs\n${JSON.stringify(process.env)}`);

  // Reads Env vars
  const outputStream = process.env.output_stream as string;

  // Reads the request
  const request = JSON.parse(postEvent['body']) as PostRequest;
  const text = decodeBase64(request.text);

  //Splits whole text by lines
  const lines = text.split(/(?:\r\n|\r|\n)/g);
  const entries = lines.filter((text: string) => text.length > 0)
    .map((text: string, line: number) => ({text, line} as TextLine));
  console.info(`Processing post from ${request.client} with ${lines.length} lines`);

  await AwsKinesisUtil.asyncPutRecords(outputStream, entries, toPutRecordsRequestEntries);
  console.info(`Successfully processed post ${request.client}`);

  // Success
  return {
    isBase64Encoded: false,
    statusCode: 200,
    headers: {...CORS_HTTP_HEADERS},
    body: ''
  } as PostResponse;
}

// export async function get(getEvent: any) {
//   process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];
//   console.info(`Get handler (${process.env['LAMBDA_TASK_ROOT']}) is running with envs\n${JSON.stringify(process.env)}`);
//   TODO
// }

export function toPutRecordsRequestEntries(record: TextLine): PutRecordsRequestEntry {
  const id = record.line + '-' + record.text;
  return {
    Data: JSON.stringify(record),
    // Generates partition keys
    PartitionKey: createHash('md5').update(id).digest('hex')
  } as PutRecordsRequestEntry
}


export function main() {

}
