import { PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';
import { TextLine } from '../../model';

it('ensures text is mapped to data records', () => {
  const toPutRecordsRequestEntries = require('./index').toPutRecordsRequestEntries;
  const textLines = [{text: 'qwe', line: 0}, {text: 'asd', line: 1}] as TextLine[];

  const records = textLines.map<PutRecordsRequestEntry>(toPutRecordsRequestEntries);
  expect(records.length).toBe(2);

  const first: PutRecordsRequestEntry = records[0];
  expect(JSON.parse(first.Data as string)).toEqual(textLines[0]);

  const second: PutRecordsRequestEntry = records[1];
  expect(JSON.parse(second.Data as string)).toEqual(textLines[1])
});
