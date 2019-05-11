import { ElasticsearchConstruct } from '../elasticsearch';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as cdk from '@aws-cdk/cdk';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';
import { VpcPlacement } from '../vpc';

// Adds ElasticsearchConstruct stream methods  declaration
declare module '../elasticsearch' {
  interface ElasticsearchConstruct {
    withDeliveryStream(fromStream: kinesis.Stream, esIndex: string, vpcPlacement?: VpcPlacement): ElasticsearchConstruct;
  }
}

export function patchElasticsearchConstructWithDeliveryStream() {
  /**
   * Adds delivery stream to populate messages to the specified ES index
   *
   * @param fromStream
   * @param index
   * @param vpcPlacement
   */
  ElasticsearchConstruct.prototype.withDeliveryStream = function (fromStream: kinesis.Stream, index: string, vpcPlacement: VpcPlacement): ElasticsearchConstruct {
    const props: StreamConnectorProps = {
      endpoint: this.endpoint,
      network: vpcPlacement,
      stream: fromStream,
      index,
    };

    new StreamConnectorConstruct(this, 'DeliveryConnector', props);

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
    const streamConnector = new lambda.Function(this, id, {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      code: lambda.Code.asset('./bin/delivery-handler'),
      environment: {
        elasticsearch_endpoint: endpoint,
        elasticsearch_index: index
      },
      ...network,
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
  network: VpcPlacement
  stream: kinesis.Stream
  index: string
}

