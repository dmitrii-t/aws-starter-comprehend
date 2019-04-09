import * as AwsKinesisUtil from '../../util/aws/kinesis';
import { TextLine } from '../../model';
//import axios from 'axios';


const headers = {'Content-Type': 'application/json'};

export async function handler(streamEvent: any) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

  console.info(`Stream connectors is running with envs\n${JSON.stringify(process.env)}`);
  // Reads Env vars
  const elasticsearch = process.env.elasticsearch_endpoint as string;

  // Submits message data to Elasticsearch
  const records = AwsKinesisUtil.parseStreamEvent<TextLine>(streamEvent);

  // await axios.post(elasticsearch, records, {headers});
  console.info(`received ${records.length} records to submit to elasticsearch:\n${JSON.stringify(records)}`)

}