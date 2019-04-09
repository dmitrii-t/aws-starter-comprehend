//
export function decodeBase64(encoded: string) {
  return new Buffer(encoded, 'base64').toString('utf8');
}
