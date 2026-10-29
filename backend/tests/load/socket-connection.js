import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, getAuthToken } from './helpers/auth.js';

// Custom Telemetry Metrics
const socketConnectionTrend = new Trend('socket_connection_duration_ms', true);
const socketConnectedCounter = new Counter('socket_connected_total');
const socketMessagesCounter = new Counter('socket_messages_received');

export const options = {
  stages: [
    { duration: '5s', target: 5 },   // Ramp-up to 5 concurrent clients
    { duration: '15s', target: 15 }, // Hold steady at 15 concurrent clients
    { duration: '5s', target: 0 },   // Graceful ramp-down
  ],
  thresholds: {
    // 95% of connection handshakes should complete under 500ms
    socket_connection_duration_ms: ['p(95)<500'],
    // At least 10 successful socket connections established
    socket_connected_total: ['count>10'],
  },
};

export function setup() {
  const token = getAuthToken('ws_tester');
  return { token };
}

export default function (data) {
  const wsUrl =
    BASE_URL.replace(/^http/, 'ws') +
    '/socket.io/?EIO=4&transport=websocket';

  const params = {
    headers: {
      Cookie: `accessToken=${data.token}`,
    },
  };

  const startTime = Date.now();

  const res = ws.connect(wsUrl, params, function (socket) {
    socket.on('open', () => {
      socketConnectionTrend.add(Date.now() - startTime);
      socketConnectedCounter.add(1);

      // In Engine.IO v4, client sends "40" to initiate Socket.IO connect
      socket.send('40');
    });

    socket.on('message', (msg) => {
      socketMessagesCounter.add(1);

      // Engine.io ping packet "2" -> respond with pong "3"
      if (msg === '2') {
        socket.send('3');
      }

      // Socket.io connect confirmation starts with "40"
      if (msg.startsWith('40')) {
        // Send a simulated job subscribe attempt
        socket.send('42["job:subscribe","507f1f77bcf86cd799439011"]');
      }
    });

    socket.on('error', (err) => {
      // Record any unhandled errors
    });

    // Keep the real-time connection alive for a brief session
    socket.setTimeout(() => {
      socket.close();
    }, 4000);
  });

  check(res, {
    'WebSocket connection successfully opened (status 101)': (r) => r && r.status === 101,
  });

  sleep(1);
}

