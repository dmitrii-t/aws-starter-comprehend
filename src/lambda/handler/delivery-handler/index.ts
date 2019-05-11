import * as aws from 'aws-sdk';
import * as AwsKinesisUtil from '../../util/aws/kinesis';
import { TextLine } from '../../model';

// Bulk upload
const defaultHeaders = {
  'Content-Type': 'application/x-ndjson'
};

// Declares missed typings
declare module 'aws-sdk' {
  const NodeHttpClient: any;
  const Signers: any;
}

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

  const indexEnv = process.env.elasticsearch_index as string;
  const endpointEnv = process.env.elasticsearch_endpoint as string;
  const endpointUrl = endpointEnv.charAt(endpointEnv.length - 1) === '/' ? endpointEnv : endpointEnv + '/';

  console.log('Elasticsearch endpoint: ' + endpointUrl);

  // Parses stream event
  const records = AwsKinesisUtil.parseStreamEvent(streamEvent);

  // Submits message data to Elasticsearch
  const actions = records.map((record) => {
    const action = {index: {_index: indexEnv, _type: '_doc'}};
    return [JSON.stringify(action), JSON.stringify(record)].join('\n')
  });
  const data = actions.join('\n') + '\n';
  console.debug(`Submitting data\n---\n${data}---`);

  const credentials = new aws.EnvironmentCredentials('AWS');

  const endpoint = new aws.Endpoint(endpointUrl);
  const request = new aws.HttpRequest(endpoint, region);
  request.method = 'POST';
  request.path = '_bulk';
  request.headers = {
    ...defaultHeaders,
    'Host': endpoint.host
  };
  request.body = data;

  const signer = new aws.Signers.V4(request, 'es');  // es: service code
  signer.addAuthorization(credentials, new Date());
  console.info(`Added authorization for service es with bound AWS credentials`);

  const http = new aws.NodeHttpClient();
  http.handleRequest(request, null, (httpResp: any) => {
    console.info('incoming \n' + JSON.stringify(httpResp));

    const encoding = (httpResp.headers['content-encoding'] || '').toLowerCase();
    if (encoding === 'gzip' || encoding === 'deflate') {
      console.warn('gzip');
      return;
    }

    httpResp.setEncoding('utf8');

    let response = '';
    httpResp.on('data', (data: any) => response += data);
    httpResp.on('error', (error: any) => context.fail(`Error ${error}`));
    httpResp.on('end', () => context.succeed(`successful response ${response}`));
  }, (error: any) => context.fail(`Err ${error}`));

  console.info(`Submitted ${records.length} records to elasticsearch`)
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
  handler(event, {})
}
