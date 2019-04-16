import { ElasticsearchConstruct } from '../elasticsearch';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as cdk from '@aws-cdk/cdk';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';
import { VpcOptions } from '../vpc';

// Adds ElasticsearchConstruct stream methods  declaration
declare module '../elasticsearch' {
  interface ElasticsearchConstruct {
    connectInputStream(inputStream: kinesis.Stream, esIndex: string, vpcOptions: VpcOptions): ElasticsearchConstruct;
  }
}

export function patchElasticsearchConstructWithInputStream() {
  ElasticsearchConstruct.prototype.connectInputStream = function (inputStream: kinesis.Stream, index: string,
                                                                  vpcOptions: VpcOptions): ElasticsearchConstruct {

    const props: StreamConnectorProps = {
      endpoint: this.endpoint,
      network: vpcOptions,
      stream: inputStream,
      index,
    };

    new StreamConnectorConstruct(this, 'StreamConnector', props);
    return this;
  };
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

interface StreamConnectorProps {
  endpoint: string
  network: VpcOptions
  stream: kinesis.Stream
  index: string
}

