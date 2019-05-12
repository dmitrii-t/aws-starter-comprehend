import { batch } from '../../batch.util';
import { PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';
import * as aws from 'aws-sdk';
import { decodeBase64 } from '../../base64.util';
import { Record } from 'aws-sdk/clients/firehose';

// AWS defined limitation
const KINESIS_PUT_RECORDS_BATCH_SIZE = 500;

// Kinesis client
const kinesis = new aws.Kinesis();

// Kinesis Firehose client
const firehose = new aws.Firehose();


/**
 * Sends records to the data stream
 *
 * @param streamName
 * @param entries
 * @param entryMapper
 */
export function kinesisPutRecordsAsync<T>(streamName: string, entries: T[], entryMapper: (entry: T) => PutRecordsRequestEntry): Promise<any> {
  const records = entries.map(entryMapper);
  return Promise.all(batch(records, KINESIS_PUT_RECORDS_BATCH_SIZE)
    .map((batch: PutRecordsRequestEntry[]) => {
      // Submits batch of records to the data stream
      return new Promise((resolve, reject) => {
        kinesis.putRecords({StreamName: streamName, Records: batch}, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    }));
}

// TODO Define a generic functin for both Kinesis and Firehose cases
export function firehosePutRecordsAsync<T>(deliveryStreamName: string, entries: T[], entryMapper: (entry: T) => Record): Promise<any> {
  const records = entries.map(entryMapper);
  return Promise.all(batch(records, KINESIS_PUT_RECORDS_BATCH_SIZE)
    .map((batch: Record[]) => {
      // Submits batch of records to the data stream
      return new Promise((resolve, reject) => {
        firehose.putRecordBatch({DeliveryStreamName: deliveryStreamName, Records: batch}, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    }));
}

export function parseStreamEvent<T>(event: any): T[] {
  const records: Array<any> = event['Records'];
  return records.map((record) => decodeBase64(record['kinesis']['data']))
    .map((str) => JSON.parse(str) as T)
}
