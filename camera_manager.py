import threading
import time
from typing import Optional, Tuple

import cv2
import numpy as np

class CameraManager:
    """
    Owns the webcam. Other modules must NEVER call cv2.VideoCapture().
    """
    def __init__(self, index: int, width: int, height: int):
        self.index = index
        self.width = width
        self.height = height
        self._cap: Optional[cv2.VideoCapture] = None
        self._lock = threading.Lock()

    def open(self) -> None:
        with self._lock:
            if self._cap is not None:
                return
            cap = cv2.VideoCapture(self.index)
            if not cap.isOpened():
                raise RuntimeError("❌ Could not open webcam. Is it plugged in?")

            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
            self._cap = cap

    def read(self) -> Tuple[bool, np.ndarray]:
        with self._lock:
            if self._cap is None:
                raise RuntimeError("Camera not opened. Call open() first.")
            ok, frame = self._cap.read()
            return ok, frame

    def close(self) -> None:
        with self._lock:
            if self._cap is not None:
                self._cap.release()
                self._cap = None

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
