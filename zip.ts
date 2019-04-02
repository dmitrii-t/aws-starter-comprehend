const archiver = require('archiver');
const fs = require('fs');

const output = fs.createWriteStream('./dist.zip');
const archive = archiver('zip', {
  zlib: {level: 9} // Sets the compression level.
});

output.on('close', function () {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');
});

// This event is fired when the data source is drained no matter what was the data source.
// It is not part of this library but rather from the NodeJS Stream API.
// @see: https://nodejs.org/api/stream.html#stream_event_end
output.on('end', function () {
  console.log('Data has been drained');
});

// good practice to catch warnings (ie stat failures and other non-blocking errors)
archive.on('warning', (err: any) => {
  if (err.code === 'ENOENT') {
    // log warning
  } else {
    // throw error
    throw err;
  }
});

// good practice to catch this error explicitly
archive.on('error', (err: any) => {
  throw err;
});

// pipe archive data to the file
archive.pipe(output);

archive.directory('node_modules/', 'node_modules');
archive.directory('bin/lambda', false);

archive.finalize();


