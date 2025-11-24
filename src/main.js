// Skeleton-only client (no color feed)
let depthWidth = 1920;
let depthHeight = 1080;

let ws = null;
let streaming = false;
// DOM canvas + context
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext && canvas.getContext('2d');
canvas.width = depthWidth;
canvas.height = depthHeight;

function startStreaming() {
  if (ws) return;
  ws = new WebSocket('ws://localhost:8081');

  ws.addEventListener('open', () => {
    streaming = true;
  });

  ws.addEventListener('message', (evt) => {
    if (typeof evt.data !== 'string') return; // ignore binary
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (e) {
      return;
    }

    if (msg.type === 'constants') {
      if (msg.depthWidth && msg.depthHeight) {
        depthWidth = msg.depthWidth;
        depthHeight = msg.depthHeight;
        canvas.width = depthWidth;
        canvas.height = depthHeight;
      }
      window.__KINECT_CONSTS = msg;
    } else if (msg.type === 'bodyFrame') {
      drawBodyFrame(msg.bodyFrame);
    }
  });

  ws.addEventListener('close', () => {
    ws = null;
    streaming = false;
  });

  ws.addEventListener('error', (err) => {
    console.error('WebSocket error', err);
  });
}

function stopStreaming() {
  if (!ws) return;
  try {
    ws.close();
  } catch (e) {}
  ws = null;
  streaming = false;
}

// auto-start
startStreaming();

// drawing helpers
const colors = [
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#00ffff',
  '#ff00ff',
];
const HANDSIZE = 20;
const HANDCLOSEDCOLOR = 'red';
const HANDOPENCOLOR = 'green';
const HANDLASSOCOLOR = 'blue';

function drawBodyFrame(bodyFrame) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!bodyFrame || !Array.isArray(bodyFrame.bodies)) return;
  const K = window.__KINECT_CONSTS || {};
  const TrackingState = K.TrackingState || {};
  const JointType = K.JointType || {};
  let idx = 0;
  for (const body of bodyFrame.bodies) {
    if (!body || !body.tracked) continue;
    // draw skeleton bones (lines) first so joints/hands render on top
    (function drawBones() {
      // robust lookup for JointType keys: try several casings
      const jtLookup = (name) =>
        JointType[name] ??
        JointType[name.charAt(0).toUpperCase() + name.slice(1)] ??
        JointType[name.toUpperCase()] ??
        null;

      const pairs = [
        ['spineBase', 'spineMid'],
        ['spineMid', 'spineShoulder'],
        ['spineShoulder', 'neck'],
        ['neck', 'head'],

        ['spineShoulder', 'shoulderLeft'],
        ['shoulderLeft', 'elbowLeft'],
        ['elbowLeft', 'wristLeft'],
        ['wristLeft', 'handLeft'],
        ['handLeft', 'handTipLeft'],

        ['spineShoulder', 'shoulderRight'],
        ['shoulderRight', 'elbowRight'],
        ['elbowRight', 'wristRight'],
        ['wristRight', 'handRight'],
        ['handRight', 'handTipRight'],

        ['spineBase', 'hipLeft'],
        ['hipLeft', 'kneeLeft'],
        ['kneeLeft', 'ankleLeft'],
        ['ankleLeft', 'footLeft'],

        ['spineBase', 'hipRight'],
        ['hipRight', 'kneeRight'],
        ['kneeRight', 'ankleRight'],
        ['ankleRight', 'footRight'],
      ];

      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';

      for (const [aName, bName] of pairs) {
        const aId = jtLookup(aName);
        const bId = jtLookup(bName);
        if (aId == null || bId == null) continue;
        const a = body.joints[aId];
        const b = body.joints[bId];
        if (!a || !b) continue;
        const tsNotTracked =
          TrackingState.notTracked !== undefined ? TrackingState.notTracked : 0;
        if (a.trackingState <= tsNotTracked || b.trackingState <= tsNotTracked)
          continue;
        const ax = a.colorX != null ? a.colorX : a.depthX * canvas.width;
        const ay = a.colorY != null ? a.colorY : a.depthY * canvas.height;
        const bx = b.colorX != null ? b.colorX : b.depthX * canvas.width;
        const by = b.colorY != null ? b.colorY : b.depthY * canvas.height;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.closePath();
      }
    })();
    for (const jt of Object.keys(body.joints || {})) {
      const joint = body.joints[jt];
      if (!joint) continue;
      const tsNotTracked =
        TrackingState.notTracked !== undefined ? TrackingState.notTracked : 0;
      if (joint.trackingState <= tsNotTracked) continue;
      ctx.fillStyle = colors[idx % colors.length];
      let size = 4;
      const tsTracked =
        TrackingState.tracked !== undefined ? TrackingState.tracked : 2;
      if (joint.trackingState === tsTracked) size = 12;
      const x =
        joint.colorX != null ? joint.colorX : joint.depthX * canvas.width;
      const y =
        joint.colorY != null ? joint.colorY : joint.depthY * canvas.height;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    updateHandState(body.leftHandState, body.joints[JointType.handLeft]);
    updateHandState(body.rightHandState, body.joints[JointType.handRight]);
    idx++;
  }
}

function updateHandState(handState, jointPoint) {
  if (!jointPoint) return;
  const K = window.__KINECT_CONSTS || {};
  const HandState = K.HandState || {};
  switch (handState) {
    case HandState.closed:
      drawHand(jointPoint, HANDCLOSEDCOLOR);
      break;
    case HandState.open:
      drawHand(jointPoint, HANDOPENCOLOR);
      break;
    case HandState.lasso:
      drawHand(jointPoint, HANDLASSOCOLOR);
      break;
    default:
      break;
  }
}

function drawHand(jointPoint, handColor) {
  if (!jointPoint) return;
  const x =
    jointPoint.colorX != null
      ? jointPoint.colorX
      : jointPoint.depthX * canvas.width;
  const y =
    jointPoint.colorY != null
      ? jointPoint.colorY
      : jointPoint.depthY * canvas.height;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.fillStyle = handColor;
  ctx.arc(x, y, HANDSIZE, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();
  ctx.globalAlpha = 1;
}
