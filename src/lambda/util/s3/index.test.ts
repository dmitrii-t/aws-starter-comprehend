import { S3obj } from './';

it('ensures event file is extracted', () => {
  const parseS3obj = require('./index').parseS3obj;
  const event = {
    'Records': [
      {
        'eventVersion': '2.1',
        'eventSource': 'aws:s3',
        'awsRegion': 'us-west-2',
        'eventTime': '2019-03-20T10:54:54.272Z',
        'eventName': 'ObjectCreated:Put',
        'userIdentity': {
          'principalId': ''
        },
        'requestParameters': {
          'sourceIPAddress': ''
        },
        'responseElements': {
          'x-amz-request-id': '',
          'x-amz-id-2': ''
        },
        's3': {
          's3SchemaVersion': '1.0',
          'configurationId': '',
          'bucket': {
            'name': 'test-bucket',
            'ownerIdentity': {
              'principalId': ''
            },
            'arn': 'arn:aws:s3'
          },
          'object': {
            'key': 'qwe.txt',
            'size': 39,
            'eTag': '',
            'sequencer': ''
          }
        }
      }
    ]
  };


  const s3obj: S3obj = parseS3obj(event);
  expect(s3obj.bucket).toBe('test-bucket');
  expect(s3obj.format).toBe('txt');
  expect(s3obj.key).toBe('qwe.txt');
});
