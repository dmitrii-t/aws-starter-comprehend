# AWS Starter Comprehend
The project is a serverless application which utilizes S3, Lambda, Kinesis Data Streams, 
Comprehend, Elasticsearch and Cloud Development Kit to handle text file, stream lines 
from that file to Kinesis data stream, complete sentiment analysis for each line with Comprehend 
and persist the results to Elasticsearch for further analysis. 

# Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
