import requests
import zipfile
import io
import os
import difflib
import sys
import shutil

# Configuration
REPO_ZIP_URL = 'https://github.com/linqfy/horsesShit/archive/refs/heads/master.zip'
EXCLUDE_NAMES = {'horse.db', 'egresos.json', 'egresos_payments.json', 'app.log'}
EXCLUDE_DIRS = {'backups_datos'}


def main():
    print('Downloading update package...')
    resp = requests.get(REPO_ZIP_URL)
    resp.raise_for_status()
    archive = zipfile.ZipFile(io.BytesIO(resp.content))
    members = archive.namelist()
    if not members:
        print('No files in update package.')
        return
    # determine root folder inside zip
    root = members[0].split('/')[0] + '/'

    # create any new directories from the update package
    for member in members:
        if not member.endswith('/'):
            continue
        rel = member[len(root):] if member.startswith(root) else member
        if not rel or any(rel.startswith(d + '/') for d in EXCLUDE_DIRS):
            continue
        dest_dir = os.path.normpath(os.path.join(os.getcwd(), rel))
        os.makedirs(dest_dir, exist_ok=True)
        print(f'Ensured directory exists: {rel}')

    # collect files to process
    updates = []  # list of (zip_path, relative_path)
    for member in members:
        if member.endswith('/'):
            continue
        rel = member[len(root):] if member.startswith(root) else member
        name = os.path.basename(rel)
        if name in EXCLUDE_NAMES:
            continue
        if any(rel.startswith(d + '/') for d in EXCLUDE_DIRS):
            continue
        updates.append((member, rel))

    if not updates:
        print('No updatable files found.')
        return

    # show diffs
    print('\nChanges to be applied:')
    for member, rel in updates:
        dest_path = os.path.normpath(os.path.join(os.getcwd(), rel))
        new_bytes = archive.read(member)
        try:
            new_text = new_bytes.decode('utf-8', errors='ignore').splitlines()
        except Exception:
            print(f'Binary update: {rel}')
            continue
        if os.path.exists(dest_path):
            with open(dest_path, 'r', encoding='utf-8', errors='ignore') as f:
                old_text = f.read().splitlines()
            diff = list(difflib.unified_diff(old_text, new_text, fromfile=rel, tofile=rel, lineterm=''))
            if diff:
                print('\n'.join(diff))
        else:
            print(f'New file: {rel}')

    # apply updates

    # remove existing node_modules in frontend if present
    node_modules_path = os.path.join(os.getcwd(), 'front', 'node_modules')
    if os.path.isdir(node_modules_path):
        print('Removing existing node_modules in frontend...')
        shutil.rmtree(node_modules_path)

    for member, rel in updates:
        dest_path = os.path.normpath(os.path.join(os.getcwd(), rel))
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, 'wb') as f:
            f.write(archive.read(member))
        print(f'Updated: {rel}')

    print('Update completed.')

    print('Cleaning up...')
    # remove zip file
    if os.path.exists('master.zip'):
        os.remove('master.zip')
    
    print('Post-installation tasks...')
    # Run pnpm install in the frontend directory
    frontend_dir = os.path.join(os.getcwd(), 'front')
    os.chdir(frontend_dir)
    os.system('pnpm install')
    os.system('pnpm build')
    os.chdir(os.path.dirname(os.getcwd()))  # Go back to the original directory

    print('Frontend build completed.')

    



if __name__ == '__main__':
    sys.argv[0] = os.path.basename(__file__)
    if len(sys.argv) > 1 and sys.argv[1] == '--postinstall':
        print('Post-installation tasks... + node_modules removal')

        # remove existing node_modules in frontend if present
        node_modules_path = os.path.join(os.getcwd(), 'front', 'node_modules')
        if os.path.isdir(node_modules_path):
            print('Removing existing node_modules in frontend...')
            shutil.rmtree(node_modules_path) 

        # Run pnpm install in the frontend directory
        frontend_dir = os.path.join(os.getcwd(), 'front')
        os.chdir(frontend_dir)
        os.system('pnpm install')
        os.system('pnpm build')
        os.chdir(os.path.dirname(os.getcwd()))  # Go back to the original directory
        print('Update skipped.')
    elif len(sys.argv) > 1 and sys.argv[1] == '--kill-ports':
        print('Killing ports...')
        # Cross-platform way to kill processes on specific ports
        if sys.platform.startswith('win'):
            # Windows
            os.system('for /f "tokens=5" %p in (\'netstat -ano ^| findstr :3000\') do taskkill /F /PID %p')
            os.system('for /f "tokens=5" %p in (\'netstat -ano ^| findstr :8080\') do taskkill /F /PID %p')
        else:
            # macOS, Linux and other Unix-like systems
            os.system('pkill -f "port 3000" || lsof -ti:3000 | xargs kill -9 2>/dev/null || true')
            os.system('pkill -f "port 8080" || lsof -ti:8080 | xargs kill -9 2>/dev/null || true')
        
        print("Ports 3000 and 8080 have been freed up.")        
    else:
        main()