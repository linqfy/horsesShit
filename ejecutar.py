import os
import subprocess
import signal
import sys
import time
import psutil
from pathlib import Path
from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtCore import QTimer, QUrl
from PySide6.QtWebEngineCore import QWebEngineProfile, QWebEngineDownloadRequest
from PySide6.QtWidgets import QInputDialog
import tkinter as tk
from tkinter import filedialog

VERSION = "1.4.5"


def start_hidden_process(command, cwd):
    """Start a subprocess with platform-specific optimizations."""
    env = os.environ.copy()
    
    if sys.platform == "darwin":  # macOS specific
        # Prevent Python subprocesses from creating GUI windows
        env["PYTHONUNBUFFERED"] = "1"
        env["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"
        
        return subprocess.Popen(
            command,
            cwd=cwd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            preexec_fn=os.setsid,
            text=True,
            bufsize=1
        )
    else:  # Windows and Linux
        return subprocess.Popen(
            command,
            cwd=cwd,
            shell=True,
            #stdout=subprocess.DEVNULL,
            #stderr=subprocess.DEVNULL,
            #creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            preexec_fn=None if os.name == "nt" else os.setsid
        )

def terminate_process_tree(pid):
    """Gracefully terminate a process tree with platform-specific handling."""
    try:
        parent = psutil.Process(pid)
        
        if sys.platform == "darwin":
            # Send SIGTERM to process group on macOS
            os.killpg(os.getpgid(pid), signal.SIGTERM)
            
            def on_terminate(proc):
                print(f"Process {proc.pid} terminated")
            
            # Wait for children to terminate
            children = parent.children(recursive=True)
            for child in children:
                child.terminate()
            
            gone, alive = psutil.wait_procs(children, timeout=3, callback=on_terminate)
            
            # Force kill if still alive
            for p in alive:
                p.kill()
        else:
            # Windows/Linux handling
            for child in parent.children(recursive=True):
                child.terminate()
            parent.terminate()
            psutil.wait_procs(parent.children(), timeout=5)
            parent.wait(5)
            
    except psutil.NoSuchProcess:
        pass
    except Exception as e:
        print(f"Error terminating process tree for PID {pid}: {e}")

class AppWindow(QMainWindow):
    def __init__(self, url, backend_process, frontend_process):
        super().__init__()
        self.setWindowTitle(f"Caballos app v{VERSION}")
        screen = QApplication.primaryScreen().geometry()
        width = (screen.width() // 4) * 3
        height = screen.height() // 4 * 3
        self.setGeometry((screen.width() - width) // 2, (screen.height() - height) // 2, width, height)
        
        # Configure web profile and downloads
        profile = QWebEngineProfile.defaultProfile()
        profile.setPersistentCookiesPolicy(QWebEngineProfile.NoPersistentCookies)
        profile.setHttpCacheType(QWebEngineProfile.MemoryHttpCache)
        
        # Connect download handler
        profile.downloadRequested.connect(self.handle_download)
        
        # Initialize web view
        self.browser = QWebEngineView()
        self.browser.setUrl(QUrl(url))
        
        # Configure browser settings
        settings = self.browser.settings()
        settings.setAttribute(settings.WebAttribute.ShowScrollBars, True)
        settings.setAttribute(settings.WebAttribute.PluginsEnabled, False)
        settings.setAttribute(settings.WebAttribute.PdfViewerEnabled, False)  # Disable built-in PDF viewer
        
        # Set up layout
        layout = QVBoxLayout()
        layout.addWidget(self.browser)
        layout.setContentsMargins(0, 0, 0, 0)
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)
        
        # Store processes
        self.backend_process = backend_process
        self.frontend_process = frontend_process
        
        # Setup health checks
        self.health_timer = QTimer(self)
        self.health_timer.timeout.connect(self.check_processes_health)
        self.health_timer.start(5000)
        
        # Create downloads directory
        self.download_dir = Path.home() / "Desktop" / "Descargas"
        self.download_dir.mkdir(exist_ok=True)


    def handle_download(self, download: QWebEngineDownloadRequest):
        """Handle file downloads from the web view using Qt's native file dialog"""
        from PySide6.QtWidgets import QFileDialog
        
        # Get suggested filename from the download request
        suggested_name = download.suggestedFileName()
        if not suggested_name.lower().endswith('.pdf'):
            suggested_name += '.pdf'
        
        # Use Qt's native file dialog
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Save File",
            str(self.download_dir / suggested_name),
            "PDF Files (*.pdf)"
        )
        
        if not file_path:
            # User canceled the dialog
            download.cancel()
            return
        
        # Set up download parameters based on the selected file path
        save_path = Path(file_path)
        
        # Handle existing files by appending a counter if needed
        counter = 1
        while save_path.exists():
            stem = save_path.stem
            # Remove previous counter if it exists
            if '_' in stem:
                base_stem = stem.rsplit('_', 1)[0]
                if base_stem and base_stem[-1].isdigit():
                    stem = base_stem
            new_name = f"{stem}_{counter}{save_path.suffix}"
            save_path = save_path.with_name(new_name)
            counter += 1
        
        download.setDownloadDirectory(str(save_path.parent))
        download.setDownloadFileName(save_path.name)
        download.accept()

        

        # Correctly connect the finished signal to your callback
        #download.connect(self.on_download_finished)


    def on_download_finished(self):
        """Callback when download completes"""
        print(f"Download completed to: {self.download_dir}")
        
    def check_processes_health(self):
        """Monitor and restart processes if needed"""
        try:
            if self.backend_process and self.backend_process.poll() is not None:
                print("Backend process died, restarting...")
                self.backend_process = start_hidden_process("python main.py", cwd="./prod")
                
            if self.frontend_process and self.frontend_process.poll() is not None:
                print("Frontend process died, restarting...")
                self.frontend_process = start_hidden_process("next start", cwd="./front")
        except Exception as e:
            print(f"Health check error: {e}")
    
    def closeEvent(self, event):
        """Handle application shutdown"""
        self.health_timer.stop()
        
        if self.backend_process:
            print(f"Terminating backend process with PID {self.backend_process.pid}")
            terminate_process_tree(self.backend_process.pid)
            
        if self.frontend_process:
            print(f"Terminating frontend process with PID {self.frontend_process.pid}")
            terminate_process_tree(self.frontend_process.pid)
        
        # Allow time for processes to clean up
        QTimer.singleShot(500, lambda: sys.exit(0))
        event.accept()

def main():
    # Ensure clean startup
    app = QApplication(sys.argv)

    splash = start_hidden_process("python splash_screen.py", cwd="./")
    time.sleep(2)  # Wait for splash screen to initialize
    
    # Start processes with delay to ensure proper initialization
    backend_process = start_hidden_process("python main.py", cwd="./prod")
    time.sleep(1)  # Wait for backend to initialize
    
    frontend_process = start_hidden_process("next start", cwd="./front")
    time.sleep(2)  # Wait for frontend to initialize
    
    url = "http://localhost:3000"
    main_window = AppWindow(url, backend_process, frontend_process)
    main_window.show()
    
    try:
        return app.exec()
    except Exception as e:
        print(f"Unexpected error: {e}")
        return 1
    finally:
        # Ensure cleanup on exit
        if backend_process:
            terminate_process_tree(backend_process.pid)
        if frontend_process:
            terminate_process_tree(frontend_process.pid)

if __name__ == "__main__":
    sys.exit(main())