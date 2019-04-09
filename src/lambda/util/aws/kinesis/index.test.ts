it('ensures data records are parsed', () => {
  const parse = require('./index').parseStreamEvent;
  const event = {
    'Records': [
      {
        'kinesis': {
          'kinesisSchemaVersion': '1.0',
          'partitionKey': '',
          'sequenceNumber': '',
          'data': new Buffer(JSON.stringify({index: 0, text: 'qwe'})).toString('base64'),
          'approximateArrivalTimestamp': 1553341843.751
        },
        'eventSource': 'aws:kinesis',
        'eventVersion': '1.0',
        'eventID': '',
        'eventName': 'aws:kinesis:record',
        'invokeIdentityArn': 'arn:aws:iam',
        'awsRegion': 'us-west-2',
        'eventSourceARN': 'arn:aws:kinesis'
      },
      {
        'kinesis': {
          'kinesisSchemaVersion': '1.0',
          'partitionKey': '',
          'sequenceNumber': '',
          'data': new Buffer(JSON.stringify({index: 1, text: 'asd'})).toString('base64'),
          'approximateArrivalTimestamp': 1553341843.752
        },
        'eventSource': 'aws:kinesis',
        'eventVersion': '1.0',
        'eventID': '',
        'eventName': 'aws:kinesis:record',
        'invokeIdentityArn': 'arn:aws:iam',
        'awsRegion': 'us-west-2',
        'eventSourceARN': 'arn:aws:kinesis'
      },
      {
        'kinesis': {
          'kinesisSchemaVersion': '1.0',
          'partitionKey': '',
          'sequenceNumber': '',
          'data': new Buffer(JSON.stringify({index: 2, text: 'zxc'})).toString('base64'),
          'approximateArrivalTimestamp': 1553341843.753
        },
        'eventSource': 'aws:kinesis',
        'eventVersion': '1.0',
        'eventID': '',
        'eventName': 'aws:kinesis:record',
        'invokeIdentityArn': 'arn:aws:iam',
        'awsRegion': 'us-west-2',
        'eventSourceARN': 'arn:aws:kinesis'
      }
    ]
  };

  console.log('event:\n' + JSON.stringify(event));

  const records = parse(event, (str: string) => JSON.parse(str));

  expect(records[0]).toEqual(({index: 0, text: 'qwe'}));
  expect(records[1]).toEqual(({index: 1, text: 'asd'}));
  expect(records[2]).toEqual(({index: 2, text: 'zxc'}));
});
