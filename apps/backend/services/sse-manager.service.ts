/**
 * SSE Manager Service
 * Manages Server-Sent Events connections and message broadcasting
 */

interface SSEClient {
  id: string;
  response: any;
  userId?: string;
  lastPing: number;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private messageQueue: Map<string, any[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start heartbeat to keep connections alive
    this.startHeartbeat();
  }

  /**
   * Add a new SSE client connection
   */
  addClient(clientId: string, response: any, userId?: string): void {
    this.clients.set(clientId, {
      id: clientId,
      response,
      userId,
      lastPing: Date.now(),
    });

    // Send initial connection message
    this.sendToClient(clientId, {
      type: 'connected',
      message: 'SSE stream connected',
      clientId,
      timestamp: new Date().toISOString(),
    });

    // Send any queued messages for this user
    if (userId) {
      const queuedMessages = this.messageQueue.get(userId) || [];
      queuedMessages.forEach(msg => this.sendToClient(clientId, msg));
      this.messageQueue.delete(userId);
    }
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      client.response.write(message);
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(data: any): void {
    const deadClients: string[] = [];
    
    this.clients.forEach((_client, clientId) => {
      if (!this.sendToClient(clientId, data)) {
        deadClients.push(clientId);
      }
    });

    // Clean up dead connections
    deadClients.forEach(id => this.removeClient(id));
  }

  /**
   * Send workflow event to relevant clients
   */
  sendWorkflowEvent(_workflowId: string, userId: string, data: any): void {
    let messageSent = false;
    
    // Find clients for this user
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId) {
        if (this.sendToClient(clientId, data)) {
          messageSent = true;
        }
      }
    });

    // If no client found, queue the message
    if (!messageSent) {
      const userQueue = this.messageQueue.get(userId) || [];
      userQueue.push(data);
      this.messageQueue.set(userId, userQueue);
      
      // Clean old messages after 5 minutes
      setTimeout(() => {
        const queue = this.messageQueue.get(userId);
        if (queue && queue.includes(data)) {
          const index = queue.indexOf(data);
          queue.splice(index, 1);
          if (queue.length === 0) {
            this.messageQueue.delete(userId);
          }
        }
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Send heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const deadClients: string[] = [];

      this.clients.forEach((client, clientId) => {
        // Send ping every 30 seconds
        if (now - client.lastPing > 30000) {
          const sent = this.sendToClient(clientId, {
            type: 'ping',
            timestamp: new Date().toISOString(),
          });
          
          if (sent) {
            client.lastPing = now;
          } else {
            deadClients.push(clientId);
          }
        }
      });

      // Clean up dead connections
      deadClients.forEach(id => this.removeClient(id));
    }, 30000);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all connections
    this.clients.forEach((client, _clientId) => {
      try {
        client.response.end();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    
    this.clients.clear();
    this.messageQueue.clear();
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    let total = 0;
    this.messageQueue.forEach(queue => {
      total += queue.length;
    });
    return total;
  }
}

// Export singleton instance
export const sseManager = new SSEManager();