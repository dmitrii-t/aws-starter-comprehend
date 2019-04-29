# AWS Starter Comprehend
The project is a serverless application which utilizes Lambda, Kinesis, API Gateway, 
Comprehend, Elasticsearch, Cloud Development Kit and CloudFormation to handle 
manually entered text lines, stream them to Kinesis to complete sentiment analysis over each line
with AWS Comprehend and persist the line and it's sentiment to Elasticsearch for further aggregation. 

# Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
