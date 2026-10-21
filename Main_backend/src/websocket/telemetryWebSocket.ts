import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import { TelemetryController } from '../controllers/telemetry.controller';

const uiClients = new Set<WebSocket>();

export function initTelemetryWebSocket(server: HttpServer): WebSocketServer {
  const uiWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? url.parse(request.url).pathname : '';

    if (pathname === '/api/v1/telemetry/ws') {
      uiWss.handleUpgrade(request, socket, head, (ws) => {
        uiWss.emit('connection', ws, request);
      });
    }
  });

  uiWss.on('connection', async (ws: WebSocket, request) => {
    uiClients.add(ws);
    console.log(`🖥️ [UI WebSocket] Frontend client connected! Active UI listeners: ${uiClients.size}`);

    const parsedUrl = request.url ? url.parse(request.url, true) : null;
    const serviceId = (parsedUrl?.query?.service_id as string) || 'sme-order-service';

    // Send immediate initial state upon connection
    try {
      const summary = await TelemetryController.getLiveSummaryData(serviceId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'initial_state',
            data: summary,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (err) {
      console.error('[UI WebSocket] Error sending initial state:', err);
    }

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        } else if (msg.type === 'request_refresh') {
          const summary = await TelemetryController.getLiveSummaryData(serviceId);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'live_summary',
                data: summary,
                timestamp: new Date().toISOString(),
              })
            );
          }
        }
      } catch (e) {
        // Ignore non-json
      }
    });

    ws.on('close', () => {
      uiClients.delete(ws);
      console.log(`🔌 [UI WebSocket] Frontend client disconnected. Remaining listeners: ${uiClients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[UI WebSocket] Connection error:', err);
      uiClients.delete(ws);
    });
  });

  // Heartbeat pulse every 3 seconds to push real-time sequence updates to all connected UI clients
  const pulseInterval = setInterval(async () => {
    if (uiClients.size === 0) return;
    try {
      const summary = await TelemetryController.getLiveSummaryData('sme-order-service');
      const payload = JSON.stringify({
        type: 'live_pulse',
        data: summary,
        timestamp: new Date().toISOString(),
      });

      for (const client of uiClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    } catch (err) {
      // Don't crash pulse loop
    }
  }, 3000);

  uiWss.on('close', () => {
    clearInterval(pulseInterval);
  });

  console.log('📡 UI Telemetry WebSocket endpoint initialized at WS /api/v1/telemetry/ws');
  return uiWss;
}

/**
 * Broadcast telemetry events to all active Frontend UI clients
 */
export function broadcastTelemetryToUi(payload: object) {
  if (uiClients.size === 0) return;
  const message = JSON.stringify(payload);
  for (const client of uiClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
