import time
from typing import List, Tuple

import numpy as np


class GestureDetector:
    """
    Robust gesture detector wrapper.

    IMPORTANT:
    On some Mac builds, `mediapipe` installs but does NOT expose `mp.solutions`.
    In that case, we DISABLE gesture mode gracefully so the whole project still runs.

    Returns:
      (annotated_frame, events_list)
    """

    def __init__(self):
        self.available = False
        self.reason = ""

        # Lazy imports for reliability
        try:
            import mediapipe as mp  # type: ignore
            self.mp = mp

            # Your current environment: hasattr(mp, "solutions") == False
            # So we must not use mp.solutions.
            if not hasattr(mp, "solutions"):
                self.available = False
                self.reason = "mediapipe installed but mp.solutions is missing on this machine"
                print(f"⚠️ GestureDetector disabled: {self.reason}")
                return

            # If somehow solutions exists, init here (future-proof)
            self.hands = mp.solutions.hands.Hands(
                static_image_mode=False,
                max_num_hands=1,
                min_detection_confidence=0.6,
                min_tracking_confidence=0.5,
            )
            self.drawer = mp.solutions.drawing_utils
            self.available = True
            print("✅ GestureDetector enabled (MediaPipe solutions available).")

        except Exception as e:
            self.available = False
            self.reason = f"MediaPipe init failed: {e}"
            print(f"⚠️ GestureDetector disabled: {self.reason}")

    def process(self, frame_bgr) -> Tuple[np.ndarray, List[dict]]:
        # If not available, do nothing but keep system alive
        if not self.available:
            return frame_bgr, []

        # If available (rare on your current setup), run detection
        import cv2  # local import

        events: List[dict] = []

        frame = cv2.flip(frame_bgr, 1)
        h, w, _ = frame.shape

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self.hands.process(rgb)

        if result.multi_hand_landmarks:
            hand_landmarks = result.multi_hand_landmarks[0]
            self.drawer.draw_landmarks(frame, hand_landmarks, self.mp.solutions.hands.HAND_CONNECTIONS)

            # Minimal event just to prove gestures are working
            events.append({
                "type": "gesture",
                "confidence": 1.0,
                "timestamp": time.time(),
                "meta": {"status": "hand_detected"}
            })

        return frame, events
