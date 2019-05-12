import * as AwsKinesisUtil from '../../util/aws/kinesis';
import * as AwsComprehendUtil from '../../util/aws/comprehend';
import { TextLine } from '../../model';
import { Record } from 'aws-sdk/clients/firehose';

export async function handler(streamEvent: any) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];
  console.info(`Stream handler is running with envs\n${JSON.stringify(process.env)}`);

  // Reads Env vars
  const outputStream = process.env.output_stream as string;

  // Parses data record
  const records = AwsKinesisUtil.parseStreamEvent<TextLine>(streamEvent);
  const sentimented = await Promise.all(records.map((record) => withSentiment(record)));

  // Blocks execution to get the results
  await AwsKinesisUtil.firehosePutRecordsAsync(outputStream, sentimented, toPutRecordsRequestEntries);
  console.info(`processed ${sentimented.length} records:\n${JSON.stringify(sentimented)}`)
}

function toPutRecordsRequestEntries(record: TextLine): Record {
  return {
    Data: JSON.stringify(record),
  } as Record
}

async function withSentiment(record: TextLine): Promise<TextLine> {
  const sentiment = await AwsComprehendUtil.asyncDetectSentiment(record.text);
  const updatedAt = new Date().getTime();
  return ({...record, sentiment, updatedAt}) as TextLine
}
