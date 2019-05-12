import * as AwsKinesisUtil from '../../util/aws/kinesis';
import axios from 'axios';
import { TextLine } from '../../model';

// Bulk upload
const defaultHeaders = {
  'Content-Type': 'application/x-ndjson',
};

/**
 * Delivery handler a lambda function to listen kinesis delivery stream and
 * submit records to the specified Elasticsearch index
 *
 * @param streamEvent
 * @param context
 */
export async function handler(streamEvent: any, context: any) {
  process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];
  console.info(`Stream connectors is running with envs\n${JSON.stringify(process.env)}`);

  // Gets Env vars
  const region = process.env.AWS_REGION!;
  console.info(`region ${region}`);

  // const localstack = process.env.LOCALSTACK_HOSTNAME;
  const indexEnv = process.env.elasticsearch_index as string;
  const endpointEnv = process.env.elasticsearch_endpoint as string;
  const endpointUrl = endpointEnv.charAt(endpointEnv.length - 1) === '/'
    ? endpointEnv.substr(0, endpointEnv.length - 1)
    : endpointEnv;

  console.log('Elasticsearch endpoint: ' + endpointUrl);

  // Parses stream event
  const records = AwsKinesisUtil.parseStreamEvent(streamEvent);

  // Submits message data to Elasticsearch
  const actions = records.map((record) => {
    const action = {index: {_index: indexEnv, _type: '_doc'}};
    return [JSON.stringify(action), JSON.stringify(record)].join('\n')
  });
  const data = actions.join('\n') + '\n';
  console.debug(`submitting data\n---\n${data}---`);

  // TODO complete bulk submit to Elasticsearch cluster
  // await axios.post(localstack + '/_bulk', data, {
  //   headers: {...defaultHeaders, 'Host': endpointUrl}
  // }).then((response) => context.succeed(`successful response ${JSON.stringify(response)}`))
  //   .catch((error) => context.fail(`error ${error}`));

  console.info(`submitted ${records.length} records to elasticsearch`)
}

// To run the handler locally
export function main() {
  console.info('Running main()');

  // Sets endpoint to point to local cluster
  process.env.elasticsearch_endpoint = 'http://localhost:9200/';
  process.env.elasticsearch_index = 'text_lines';
  process.env.AWS_REGION = 'us-west-2';

  // Test object
  const textLine: TextLine = {
    client: '123qwe-123qwe-123qwe-123qwe',
    createdAt: new Date().getTime(),
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
  handler(event, {
    succeed: (message: any) => {
    }, fail: (error: any) => {
    }
  })
}
