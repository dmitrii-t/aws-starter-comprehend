import * as AwsKinesisUtil from '../../util/aws/kinesis';
import { TextLine } from '../../model';
import axios from 'axios';

// Bulk upload
const headers = {'Content-Type': 'application/x-ndjson'};

export async function handler(streamEvent: any) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];
  console.info(`Stream connectors is running with envs\n${JSON.stringify(process.env)}`);

  // ES endpoint Env var
  const endpointEnv = process.env.elasticsearch_endpoint as string;
  const endpoint = endpointEnv.charAt(endpointEnv.length - 1) === '/' ? endpointEnv : endpointEnv + '/';
  console.log('Elasticsearch endpoint: ' + endpoint);

  // ES index Env var
  const indexEnv = process.env.elasticsearch_index as string;

  // Parses stream event
  const records = AwsKinesisUtil.parseStreamEvent(streamEvent);

  // Submits message data to Elasticsearch
  const actions = records.map((record) => {
    const action = {index: {_index: indexEnv, _type: '_doc'}};
    return [JSON.stringify(action), JSON.stringify(record)].join('\n')
  });
  const data = actions.join('\n') + '\n';
  console.debug(`Submitting data\n---\n${data}---`);

  await axios.post(endpoint + '_bulk', data, {headers});
  console.info(`Submitted ${records.length} records to elasticsearch`)
}

// Ran locally only
export function main() {
  console.info('Running main()');

  // Sets endpoint to point to local cluster
  process.env.elasticsearch_endpoint = 'http://localhost:9200/';
  process.env.elasticsearch_index = 'text_line';

  // Test object
  const textLine: TextLine = {
    filename: 'qwe.txt',
    timestamp: new Date().getTime(),
    sentiment: 'NEUTRAL',
    line: 0,
    text: 'qwe'
  };

  // Test event
  const event = {
    Records: [
      {
        kinesis: {
          data: new Buffer(JSON.stringify(textLine), 'utf8').toString('base64')
        }
      }
    ]
  };
  handler(event)
}
