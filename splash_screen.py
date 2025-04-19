import os
import sys
from pathlib import Path

from PySide6.QtCore import QTimer, Qt, QPropertyAnimation
from PySide6.QtGui import QPixmap, QColor, QPainter, QPainterPath, QFontDatabase
from PySide6.QtWidgets import QApplication, QWidget, QGraphicsOpacityEffect

class AnimatedSplashScreen(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        print("Initializing AnimatedSplashScreen...")
        # Configure window properties
        self.setWindowFlags(Qt.SplashScreen | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        print("Window properties configured.")

        # Set dimensions
        self.setFixedSize(500, 300)
        print("Splash screen dimensions set to 500x300.")

        # Center on screen
        screen = QApplication.primaryScreen().geometry()
        self.move((screen.width() - self.width()) // 2, (screen.height() - self.height()) // 2)
        print("Splash screen centered on screen.")

        # No progress property, just fade-in

        # Load custom font if available
        font_id = QFontDatabase.addApplicationFont("./assets/fonts/Montserrat-Bold.ttf")
        if font_id != -1:
            self.font_family = QFontDatabase.applicationFontFamilies(font_id)[0]
            print(f"Custom font loaded: {self.font_family}")
        else:
            self.font_family = "Segoe UI"
            print("Default font 'Segoe UI' will be used.")

        # Logo path - create a default if not found
        self.logo_path = "./assets/images/logo.png"
        if not os.path.exists(self.logo_path):
            self.has_logo = False
            print("Logo not found. Proceeding without logo.")
        else:
            self.has_logo = True
            self.logo = QPixmap(self.logo_path)
            print("Logo loaded successfully.")

        # Start fade-in animation
        self.start_animations()
        # Auto close when done
        QTimer.singleShot(5000, QApplication.quit)

    def start_animations(self):
        # Fade-in animation for entire widget
        self.fade_effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self.fade_effect)
        self.fade_anim = QPropertyAnimation(self.fade_effect, b"opacity")
        self.fade_anim.setDuration(2000)
        self.fade_anim.setStartValue(0.0)
        self.fade_anim.setEndValue(1.0)
        self.fade_anim.start()

    # No progress property needed

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        # Draw rounded black background
        path = QPainterPath()
        path.addRoundedRect(0, 0, self.width(), self.height(), 20, 20)
        painter.fillPath(path, QColor(0, 0, 0))
        # Draw centered logo
        if self.has_logo:
            scaled = self.logo.scaled(self.width() * 0.5, self.height() * 0.5, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            x = (self.width() - scaled.width()) // 2
            y = (self.height() - scaled.height()) // 2
            painter.drawPixmap(x, y, scaled)

def main():
    app = QApplication(sys.argv)
    splash = AnimatedSplashScreen()
    splash.show()
    return app.exec()

if __name__ == "__main__":
    sys.exit(main())
