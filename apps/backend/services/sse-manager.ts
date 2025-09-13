/**
 * SSE Manager for handling Server-Sent Events streaming
 */
export class SSEManager {
  private stream: any
  private closed: boolean = false

  constructor(stream: any) {
    this.stream = stream
  }

  /**
   * Send an SSE event to the client
   */
  async send(event: { type: string; data: any; timestamp: string }) {
    if (this.closed) return

    try {
      const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
      await this.stream.write(eventString)
    } catch (error) {
      console.error('Error sending SSE event:', error)
    }
  }

  /**
   * Send a ping to keep the connection alive
   */
  sendPing() {
    if (this.closed) return
    
    try {
      this.stream.write(':ping\n\n')
    } catch (error) {
      console.error('Error sending ping:', error)
    }
  }

  /**
   * Close the SSE stream
   */
  async close() {
    if (this.closed) return
    
    this.closed = true
    try {
      await this.stream.end()
    } catch (error) {
      console.error('Error closing SSE stream:', error)
    }
  }
}