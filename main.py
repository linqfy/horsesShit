import subprocess

# Run backend/prod.py and test/myapp npm run dev concurrently without showing terminals
subprocess.Popen(
    ["python", "backend/prod/main.py"],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
subprocess.Popen(
    ["npm", "run", "dev"],
    cwd="./test/myapp",
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
