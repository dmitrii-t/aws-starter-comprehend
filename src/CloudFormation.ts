#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/cdk';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as lambda from '@aws-cdk/aws-lambda';
import * as event_sources from '@aws-cdk/aws-lambda-event-sources';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';


class AwsStarterComprehendStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Defines source message bucket
    const fileBucket = new s3.Bucket(this, 'FileBucket');

    // Defines message data stream
    const contentStream = new kinesis.Stream(this, 'ContentStream');

    // Defines s3 file handler which populates file contents to the data stream
    const fileHandler = new lambda.Function(this, 'FileHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'file-handler/index.handler',
      code: lambda.Code.asset('./bin/lambda'),
      environment: {
        message_stream: contentStream.streamName
      }
    });
    fileHandler.addEventSource(new event_sources.S3EventSource(fileBucket, {
      events: [s3.EventType.ObjectCreated]
    }));
    // Adds permissions s3:GetObject* and s3:List
    fileBucket.grantRead(fileHandler.role);
    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    contentStream.grantWrite(fileHandler.role);

    // Defines message stream handler
    const contentHandler = new lambda.Function(this, 'ContentHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'content-handler/index.handler',
      code: lambda.Code.asset('./bin/lambda'),
    });
    contentHandler.addEventSource(new event_sources.KinesisEventSource(contentStream, {
      startingPosition: lambda.StartingPosition.TrimHorizon
    }));

    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    contentStream.grantRead(contentHandler.role);

    // Adds permission comprehend:DetectSentiment
    contentHandler.role!.addToPolicy(new iam.PolicyStatement()
      .addAllResources()
      .addActions('comprehend:DetectSentiment'))
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
