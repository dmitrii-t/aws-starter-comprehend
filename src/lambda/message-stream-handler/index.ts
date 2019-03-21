// Message Stream Handler
export function handler(event: any) {
  const eventStr = JSON.stringify(event);
  console.log(`Handled event ${eventStr}`)
}
