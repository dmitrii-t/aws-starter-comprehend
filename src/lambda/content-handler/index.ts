// Stream Handler
import * as aws from 'aws-sdk';
import { parse } from '../util/kinesis';
import { DataRecord } from '../model';
import { asyncDetectSentiment } from '../util/comprehend';

const comprehend = new aws.Comprehend();

export async function handler(event: any) {
  console.info(`Stream handler is running with envs\n${JSON.stringify(process.env)}`);

  // Parses data record
  const records = parse(event, (serialized: string) => {
    return JSON.parse(serialized) as DataRecord
  });

  // Detects sentiment analysiss
  const processed = await Promise.all(records.map((record) => {
    return asyncDetectSentiment(comprehend, record.text)
      .then((data: any) => {
        record.sentiment = data as string;
        return record
      })
  }));

  console.info(`Records:\n${JSON.stringify(processed)}`)
}
