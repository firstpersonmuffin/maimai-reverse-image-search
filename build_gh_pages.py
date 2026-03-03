import os
import shutil
import subprocess
import sys

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, 'frontend')
    web_dir = os.path.join(root_dir, 'web')
    out_dir = os.path.join(root_dir, 'docs')
    
    # 1. Ensure out_dir exists and is clean
    if os.path.exists(out_dir):
        print(f"Cleaning existing directory: {out_dir}")
        shutil.rmtree(out_dir)
    
    # 2. Build Vite React App
    print("Building Vite React App...")
    # Run npm run build inside frontend using shell logic
    result = subprocess.run(['npm', 'run', 'build'], cwd=frontend_dir, shell=True)
    if result.returncode != 0:
        print("Vite build failed!")
        sys.exit(1)
        
    # 3. Copy Vite dist to docs
    dist_dir = os.path.join(frontend_dir, 'dist')
    if not os.path.exists(dist_dir):
        print(f"Error: dist folder not found at {dist_dir}.")
        sys.exit(1)
        
    print("Copying React build to docs...")
    shutil.copytree(dist_dir, out_dir)
    
    # 4. Success
    print("\n✅ Build complete! The 'docs' folder is ready to be deployed.")
    print("To test locally without the backend, run: python -m http.server 8080 --directory docs")

if __name__ == "__main__":
    main()
