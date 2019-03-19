#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import kinesis = require('@aws-cdk/aws-kinesis');
import lambda = require('@aws-cdk/aws-lambda');
import event_sources = require('@aws-cdk/aws-lambda-event-sources');

class AwsStarterComprehendStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Defines message stream handler
    const messageHandler = new lambda.Function(this, 'MessageHandler', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'message-stream-handler/index.handler',
      code: lambda.Code.asset('./bin/lambda'),
    });

    // Defines source message stream
    const messageStream = new kinesis.Stream(this, 'MessageStream');
    messageHandler.addEventSource(new event_sources.KinesisEventSource(messageStream, {
      startingPosition: lambda.StartingPosition.Latest
    }))
  }
}

// Runs
const app = new cdk.App();
new AwsStarterComprehendStack(app, 'AwsStarterComprehendStack');
app.run();
