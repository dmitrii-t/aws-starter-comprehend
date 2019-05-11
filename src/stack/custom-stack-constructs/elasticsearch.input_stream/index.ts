import { ElasticsearchConstruct } from '../elasticsearch';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as cdk from '@aws-cdk/cdk';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';
import { VpcPlacement } from '../vpc';
import * as iam from '@aws-cdk/aws-iam';

export interface DeliveryProps {
  vpcPlacement: VpcPlacement
  timeout: number
  searchIndex: string
}

// Adds ElasticsearchConstruct stream method declarations
declare module '../elasticsearch' {
  interface ElasticsearchConstruct {
    withDeliveryStream(fromStream: kinesis.Stream, props: DeliveryProps): ElasticsearchConstruct;
  }
}

export function patchElasticsearchConstructWithDeliveryStream() {
  /**
   * Adds delivery stream to populate messages to the specified ES index
   *
   * @param fromStream
   * @param props
   */
  ElasticsearchConstruct.prototype.withDeliveryStream = function (fromStream: kinesis.Stream, props: DeliveryProps): ElasticsearchConstruct {
    const connectorProps: StreamConnectorProps = {
      endpoint: this.endpoint,
      stream: fromStream,
      ...props,
    };

    const connectorConstruct = new StreamConnectorConstruct(this, 'DeliveryConnector', connectorProps);

    // Grants ESHttp* access
    connectorConstruct.streamConnector.role!.addToPolicy(new iam.PolicyStatement()
      .addResource(this.instance.domainArn)
      .addActions('es:ESHttp*'));

    return this;
  };
}

class StreamConnectorConstruct extends cdk.Construct {

  streamConnector: lambda.Function;

  constructor(scope: cdk.Construct, id: string, props: StreamConnectorProps) {
    super(scope, id);

    const {
      endpoint, vpcPlacement, stream, searchIndex
    } = props;

    // Defines message stream handler
    this.streamConnector = new lambda.Function(this, id, {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'index.handler',
      timeout: props.timeout,
      code: lambda.Code.asset('./bin/delivery-handler'),
      environment: {
        elasticsearch_endpoint: endpoint,
        elasticsearch_index: searchIndex
      },
      ...vpcPlacement,
    });

    this.streamConnector.addEventSource(new event_sources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.Latest
    }));

    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    stream.grantRead(this.streamConnector.role);


  }
}

interface StreamConnectorProps extends DeliveryProps {
  endpoint: string
  stream: kinesis.Stream
}

