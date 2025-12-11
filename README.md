# 🤖 Kinekit — Kinect2 Interaction Demo

**Real-time skeletal tracking and web-based visualization using Kinect v2 and Node.js.**

[![GitHub license](https://img.shields.io/github/license/finalisti/kinect2-demo)](https://github.com/finalisti/kinect2-demo/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/finalisti/kinect2-demo)](https://github.com/finalisti/kinect2-demo/stargazers)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Kinect v2](https://img.shields.com/badge/Kinect_v2-0078D4?style=flat&logo=windows&logoColor=white)](https://docs.microsoft.com/en-us/previous-versions/windows/kinect/dn758204(v=kinect.20))

## 🌟 Project Overview

**Kinekit** is a proof-of-concept project demonstrating how to capture real-time 3D skeletal tracking data from a Microsoft Kinect v2 sensor, process it on a Node.js server, and stream it via WebSockets to an accessible, browser-based visualization.

This setup is ideal for interactive installations, rapid prototyping for Human-Computer Interaction (HCI) concepts, and art projects that require body-driven input.

## 🚀 Features

* **Real-Time Tracking:** Low-latency skeletal joint data streaming.
* **WebSockets:** Efficient transport of JSON pose data to the client.
* **Browser-Based UI:** Visualization rendered using HTML Canvas/WebGL in `main.js`.
* **Modular Architecture:** Clear separation between hardware interfacing (Node.js) and rendering (Client).
* **Simple Gesture Detection:** Basic examples for mapping body movements (e.g., hand position) to visual effects.

## ⚙️ Architecture

The project follows a simple client-server model:

```mermaid
graph LR
    A[Kinect v2 Sensor] -->|Depth, Color, Skeleton Frames| B(Node.js Server: server.js);
    B -->|Process Pose Data| C{WebSocket/Socket.io};
    C -->|JSON Pose Updates| D(Web Client: index.html/main.js);
    D --> E[Interactive Visualization];
