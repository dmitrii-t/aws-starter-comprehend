import { PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';
import { DataRecord } from '../../model';

it('ensures text is mapped to data records', () => {
  const toPutRecordsRequestEntries = require('./index').toPutRecordsRequestEntries;
  const toDataRecords = require('./index').toDataRecords;
  const text = 'qwe\n\nasd';

  const records = toDataRecords(text).map(toPutRecordsRequestEntries);
  expect(records.length).toBe(2);

  const first: PutRecordsRequestEntry = records[0];
  expect(JSON.parse(first.Data as string)).toEqual(({lineNo: 0, text: 'qwe'} as DataRecord));

  const second: PutRecordsRequestEntry = records[1];
  expect(JSON.parse(second.Data as string)).toEqual(({lineNo: 1, text: 'asd'} as DataRecord))
});
