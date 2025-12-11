import Kinect2 from 'kinect2';
import {WebSocketServer} from 'ws';
import {keyboard, Key} from '@nut-tree-fork/nut-js';
import {spawn} from 'child_process';

function sendMouseDelta(dx, dy) {
  try {
    spawn('./mouse_delta.exe', [String(dx), String(dy)], {
      windowsHide: true,
    });
  } catch (e) {
    console.error('mouse_delta.exe error:', e);
  }
}

const PORT = 8081;
const kinect = new Kinect2();
const wss = new WebSocketServer({port: PORT});

let wPressed = false;

if (!kinect.open()) {
  console.error('Failed to open Kinect.');
  process.exit(1);
}

console.log(`WebSocket server running on ws://localhost:${PORT}`);

function serializeEnum(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string' || typeof v === 'number') out[k] = v;
  }
  return out;
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.send(
    JSON.stringify({
      type: 'constants',
      JointType: serializeEnum(Kinect2.JointType),
      HandState: serializeEnum(Kinect2.HandState),
      TrackingState: serializeEnum(Kinect2.TrackingState),
      depthWidth: 1920,
      depthHeight: 1080,
    }),
  );

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    const cmd = msg.cmd;
    if (!cmd) return;

    if (cmd === 'MOUSE_MOVE') {
      const dir = msg.dir;
      if (dir === -1) sendMouseDelta(-40, 0);
      if (dir === 1) sendMouseDelta(40, 0);
    } else if (cmd === 'W_DOWN') {
      if (!wPressed) {
        await keyboard.pressKey(Key.W);
        wPressed = true;
      }
    } else if (cmd === 'W_UP') {
      if (wPressed) {
        await keyboard.releaseKey(Key.W);
        wPressed = false;
      }
    }
  });

  if (wss.clients.size === 1) {
    kinect.openBodyReader();
    console.log('Body reader started');
  }

  ws.on('close', () => {
    console.log('Client disconnected');
    if (wss.clients.size === 0) {
      kinect.closeBodyReader();
    }
  });
});

function mapJointToColor(joint) {
  if (!joint) return {x: 0, y: 0};
  return {
    x: joint.depthX * 1920,
    y: joint.depthY * 1080,
  };
}

kinect.on('bodyFrame', (frame) => {
  const bodies = (frame && frame.bodies) || [];

  const mapped = {
    bodies: bodies
      .map((b) => {
        if (!b) return null;
        let newBody = {...b, joints: {}};
        for (const jt of Object.keys(b.joints || {})) {
          const j = b.joints[jt];
          const mappedPoint = mapJointToColor(j);
          newBody.joints[jt] = {
            depthX: j.depthX,
            depthY: j.depthY,
            cameraX: j.cameraX,
            cameraY: j.cameraY,
            cameraZ: j.cameraZ,
            trackingState: j.trackingState,
            colorX: mappedPoint.x,
            colorY: mappedPoint.y,
          };
        }
        return newBody;
      })
      .filter(Boolean),
  };

  const msg = JSON.stringify({type: 'bodyFrame', bodyFrame: mapped});

  for (const c of wss.clients) {
    if (c.readyState === c.OPEN) c.send(msg);
  }
});
