import * as AwsKinesisUtil from '../../util/kinesis';
import * as AwsComprehendUtil from '../../util/comprehend';
import { DataRecord } from '../../model';
import { toPutRecordsRequestEntries } from '../http-handler';

export async function handler(streamEvent: any) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

  console.info(`Stream handler is running with envs\n${JSON.stringify(process.env)}`);

  // Reads Env vars
  const outputStream = process.env.output_stream as string;

  // Parses data record
  const records = AwsKinesisUtil.parse(streamEvent, (data: string) =>
    ({...JSON.parse(data), ...{timestamp: new Date().getTime()}}) as DataRecord);

  // Blocks execution to get the results
  const processed = await Promise.all<DataRecord>(records.map((record) => withDetectedSentiment(record)));
  await AwsKinesisUtil.asyncPutRecords(outputStream, processed, toPutRecordsRequestEntries);

  console.info(`Records:\n${JSON.stringify(processed)}`)
}

async function withDetectedSentiment(record: DataRecord): Promise<DataRecord> {
  const sentiment = await AwsComprehendUtil.asyncDetectSentiment(record.text);
  return ({...record, ...{sentiment}}) as DataRecord
}
