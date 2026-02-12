# 🎨 AirMotion Canvas

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-0.10-orange?logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.8-green?logo=opencv&logoColor=white)](https://opencv.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Draw in the air — touchless, real‑time, gesture‑controlled.**

**AirMotion Canvas** is a computer vision system that transforms your hand movements into digital strokes. Using only a standard webcam, it tracks your index finger to draw on a virtual canvas, while a separate motion detection engine monitors environmental activity. Built for accessibility and hygiene, this project demonstrates how vision‑based interaction can replace physical peripherals.

<p align="center">
  <img src="docs/demo.gif" alt="AirMotion Canvas Demo" width="600">
  <br>
  <em>(Replace this path with your actual demo GIF)</em>
</p>

---

## 🔍 Problem Statement

Traditional drawing tools (styluses, touchscreens, mice) require **physical contact**, which presents challenges:
- **Inaccessible** for individuals with motor impairments who cannot grip devices.
- **Unhygienic** in shared public spaces like classrooms or hospital kiosks.
- **Hardware-dependent**, requiring specific, often expensive, peripherals.

There is a growing need for **contactless, intuitive interfaces** that bridge the gap between physical gesture and digital creation.

---

## 💡 Solution Overview

AirMotion Canvas delivers a **real‑time, gesture‑driven drawing system** running on two independent engines:

1. **Air Canvas Engine**: Leverages MediaPipe to detect 21 hand landmarks. It interprets the "Index Finger Up" gesture as a brush and other hand states as "hover" or "stop."
2. **Motion Detector Engine**: Utilizes background subtraction and contour analysis to detect large movements in the frame, serving as a foundation for gesture-based security or mode switching.

A **live web dashboard** aggregates data from both engines, visualizing system status in real-time.

---

## ✨ Key Features

- ✍️ **Fingertip Drawing**: Natural, responsive stroke rendering using just your index finger.
- ⏸️ **Hover Mode**: Raise two fingers (Index + Middle) to pause drawing and move the cursor without marking the canvas.
- 🧹 **Clear Canvas**: Simple gesture or keyboard command to wipe the slate clean.
- 🕵️ **Motion Alerts**: Background monitoring detects and flags significant environmental movement.
- 🧩 **Modular Architecture**: Decoupled detection engines allow for easy scaling or swapping of models.

---

## 🏗️ System Architecture

The project follows a pipeline architecture where video frames are processed, analyzed for gestures, and blended with a virtual canvas layer before being streamed to the web interface.

```mermaid
graph TD
    subgraph Hardware
        Webcam(📷 Webcam)
    end

    subgraph Backend ["Python Backend (OpenCV + MediaPipe)"]
        FrameGen[Frame Capture]
        
        subgraph Engines ["Detection Engines"]
            direction TB
            AC[🎨 Air Canvas Engine]
            MD[🏃 Motion Detector]
        end
        
        Logic{Gesture Logic}
        Canvas[Virtual Canvas Layer]
        Alerts[Motion Alerts]
        Merger[Frame Blending]
    end

    subgraph Server ["Web Server"]
        Flask[🔥 Flask App]
        Route[/video_feed Route/]
    end

    subgraph Frontend ["Client Side"]
        Browser[💻 Web Dashboard]
        UI[HTML/CSS/JS Overlay]
    end

    %% Connections
    Webcam ==> |Raw Stream| FrameGen
    FrameGen --> |Frame Copy| AC
    FrameGen --> |Frame Copy| MD

    AC --> |Hand Landmarks| Logic
    Logic --> |Index Up| Canvas
    MD --> |Background Subtraction| Alerts

    Canvas --> Merger
    FrameGen --> Merger
    Alerts -.-> |State Update| Flask

    Merger --> |Processed Frame| Flask
    Flask --> |MJPEG Stream| Route
    Route ==> |Http Response| Browser
    UI -.-> |User Controls| Browser


