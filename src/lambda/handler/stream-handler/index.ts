import * as KinesisUtil from '../../util/kinesis';
import * as ComprehendUtil from '../../util/comprehend';
import axios from 'axios';
import { DataRecord } from '../../model';

const headers = {'Content-Type': 'application/json'};

export async function handler(messageEvent: any) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

  console.info(`Stream handler is running with envs\n${JSON.stringify(process.env)}`);

  // Reads Env vars
  const elasticsearchEndpoint = process.env.elasticsearch_endpoint as string;

  // Parses data record
  const records = KinesisUtil.parse(messageEvent, (data: string) =>
    ({...JSON.parse(data), ...{timestamp: new Date().getTime()}}) as DataRecord);

  // Detects sentiment
  const promises = records.map((record) => {
    // 1. Detects sentiment
    return ComprehendUtil.asyncDetectSentiment(record.text)
    // 2. Assigns sentiment to the record
      .then((data: any) => ({...record, ...{sentiment: data as string}}))
      // 3. Posts the record to elasticsearch
      .then((data: any) => axios.post(elasticsearchEndpoint, data, {headers}))
      .catch((error) => console.error(`Fail to process file [${record.filename}:${record.lineNo}]\n${error}`))
  });

  // Blocks execution to get the results
  const processed = await Promise.all(promises);

  console.info(`Records:\n${JSON.stringify(processed)}`)
}
