import { batch } from '../batch.util';
import { PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';
import * as aws from 'aws-sdk';

// AWS defined limitation
const KINESIS_PUT_RECORDS_BATCH_SIZE = 500;

const client = new aws.Kinesis();

/**
 * Sends records to the data stream
 *
 * @param kinesis
 * @param streamName
 * @param entries
 * @param entryMapper
 */
export function asyncPutRecords<T>(streamName: string, entries: T[], entryMapper: (entry: T) => PutRecordsRequestEntry): Promise<any> {
  // Accumulates all tasks to put records
  const tasks: Promise<any>[] = [];

  const records = entries.map(entryMapper);
  batch(records, KINESIS_PUT_RECORDS_BATCH_SIZE)
    .forEach((batch: PutRecordsRequestEntry[]) => {
      // Submits batch of records to the data stream
      const batchTask = new Promise((resolve, reject) => {
        client.putRecords({StreamName: streamName, Records: batch}, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      tasks.push(batchTask)
    });

  // Consolidated promise
  return Promise.all(tasks)
}

export function parse<T>(event: any, parser: (str: string) => T): T[] {
  const records: Array<any> = event['Records'];
  return records.map(parseData).map(parser)
}

function parseData(record: any) {
  const encoded = record['kinesis']['data'];
  const buff = new Buffer(encoded, 'base64');
  return buff.toString('utf8');
}
