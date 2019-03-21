#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import kinesis = require('@aws-cdk/aws-kinesis');
import lambda = require('@aws-cdk/aws-lambda');
import event_sources = require('@aws-cdk/aws-lambda-event-sources');
import s3 = require('@aws-cdk/aws-s3');

class AwsStarterComprehendStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Defines source message bucket
    const messageFiles = new s3.Bucket(this, 'MessageBucket');

    // Defines message data stream
    const messageStream = new kinesis.Stream(this, 'MessageStream');

    // Defines s3 file handler which populates file contents to the data stream
    const messageFileHandler = new lambda.Function(this, 'MessageFileHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'message-file-handler/index.handler',
      code: lambda.Code.asset('./bin/lambda'),
      environment: {
        message_stream: messageStream.streamName
      }
    });
    messageFileHandler.addEventSource(new event_sources.S3EventSource(messageFiles, {
      events: [s3.EventType.ObjectCreated]
    }));
    // Adds permissions s3:GetObject* and s3:List
    messageFiles.grantRead(messageFileHandler.role);
    // Adds permissions kinesis:DescribeStream, kinesis:PutRecord, kinesis:PutRecords
    messageStream.grantWrite(messageFileHandler.role);

    // Defines message stream handler
    // const messageHandler = new lambda.Function(this, 'MessageHandler', {
    //   runtime: lambda.Runtime.NodeJS810,
    //   handler: 'message-stream-handler/index.handler',
    //   code: lambda.Code.asset('./bin/lambda'),
    // });
    // messageHandler.addEventSource(new event_sources.KinesisEventSource(messageStream, {
    //   startingPosition: lambda.StartingPosition.Latest
    // }))
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
