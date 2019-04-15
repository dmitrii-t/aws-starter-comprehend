import { ElasticsearchConstruct } from './index';
import * as kinesis from '@aws-cdk/aws-kinesis';
import { Ec2NetworkPops } from '../';
import * as cdk from '@aws-cdk/cdk';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';

// Adds ElasticsearchConstruct stream methods  declaration
declare module './index' {
  interface ElasticsearchConstruct {
    connectInputStream(inputStream: kinesis.Stream, esIndex: string): ElasticsearchConstruct;
  }
}

export function patchElasticsearchConstructWithInputStream() {
  ElasticsearchConstruct.prototype.connectInputStream = function (inputStream: kinesis.Stream, index: string): ElasticsearchConstruct {

    const props: StreamConnectorProps = {
      endpoint: this.endpoint,
      network: this.network,
      stream: inputStream,
      index,
    };

    new StreamConnectorConstruct(this, 'StreamConnector', props);
    return this;
  };
}

interface StreamConnectorProps {
  endpoint: string
  network: Ec2NetworkPops
  stream: kinesis.Stream
  index: string
}

class StreamConnectorConstruct extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: StreamConnectorProps) {
    super(scope, id);

    const {
      endpoint, network, stream, index
    } = props;

    // Defines message stream handler
    const streamConnector = new lambda.Function(this, 'StreamConnector', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      code: lambda.Code.asset('./bin/stream-connector'),
      ...network,
      environment: {
        elasticsearch_endpoint: endpoint,
        elasticsearch_index: index
      }
    });

    streamConnector.addEventSource(new event_sources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.TrimHorizon
    }));

    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    stream.grantRead(streamConnector.role);
  }
}
