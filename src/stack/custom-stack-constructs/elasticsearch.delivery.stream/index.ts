import { ElasticsearchConstruct } from '../elasticsearch';
import * as cdk from '@aws-cdk/cdk';
import * as iam from '@aws-cdk/aws-iam';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose';
import { Bucket } from '@aws-cdk/aws-s3';


/**
 * Props to configure delivery stream for Elasticsearch cluster
 */
export interface DeliveryProps {
  backupBucket: Bucket;
  elasticsearchIndex: string
}

// Adds ElasticsearchConstruct stream method declarations
declare module '../elasticsearch' {

  interface ElasticsearchConstruct {
    withDeliveryStream(name: string, props: DeliveryProps): ElasticsearchConstruct;

    getDeliveryStream(name: string): CfnDeliveryStream

    deliveryStreams: { [key: string]: CfnDeliveryStream }
  }
}

/**
 * Patches Elasticsearch construct  with the ability to configure delivery stream to
 * deliver messages from kinesis stream to Elasticsearch cluster
 *
 */
export function patchElasticsearchConstructWithDeliveryStream() {

  /**
   * Holds map name to delivery stream
   *
   */
  ElasticsearchConstruct.prototype.deliveryStreams = {};

  /**
   * Returns delivery stream by name
   *
   * @param name
   */
  ElasticsearchConstruct.prototype.getDeliveryStream = function (name: string): CfnDeliveryStream {
    return this.deliveryStreams[name];
  };

  /**
   * Adds delivery stream to populate messages to the specified ES index
   *
   * @param id
   * @param props
   */
  ElasticsearchConstruct.prototype.withDeliveryStream = function (id: string, props: DeliveryProps): ElasticsearchConstruct {
    //
    const {
      backupBucket, elasticsearchIndex
    } = props;

    const deliveryRole = new iam.Role(this, 'DeliveryRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });
    // Adds statement to write backups to s3
    deliveryRole.addToPolicy(new iam.PolicyStatement()
      .addResource(backupBucket.bucketArn)
      .addActions('s3:*'));
    // Adds statement to access to the Elasticsearch domain
    deliveryRole.addToPolicy(new iam.PolicyStatement()
      .addResource(this.domainArn + '/*')
      .addResource(this.domainArn)
      .addActions('es:*'));
    deliveryRole.node.addDependency(this);

    //
    const deliveryStream = new firehose.CfnDeliveryStream(this, id, {
      elasticsearchDestinationConfiguration: {
        domainArn: this.domainArn,
        indexName: elasticsearchIndex,
        indexRotationPeriod: 'NoRotation',
        typeName: '_doc',
        roleArn: deliveryRole.roleArn,
        retryOptions: {
          durationInSeconds: 60
        },
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 50
        },
        s3BackupMode: 'AllDocuments',
        s3Configuration: {
          bucketArn: backupBucket.bucketArn,
          compressionFormat: 'UNCOMPRESSED',
          roleArn: deliveryRole.roleArn,
          bufferingHints: {
            intervalInSeconds: 60,
            sizeInMBs: 50
          },
        }
      }
    });

    // Persists delivery stream
    this.deliveryStreams[id] = deliveryStream;

    const deliveryStreamOutput = new cdk.CfnOutput(this, 'DeliveryStreamArn', {
      description: 'Delivery stream ARN',
      value: deliveryStream.deliveryStreamArn
    });

    return this;
  };
}
