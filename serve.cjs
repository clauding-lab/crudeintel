// Wrapper to fix CWD in sandboxed environments
const PROJECT_DIR = '/Users/adnanrashid/Downloads/Pertroleum-Paper';
try { process.chdir(PROJECT_DIR); } catch {}
process.cwd = () => PROJECT_DIR;
require(PROJECT_DIR + '/node_modules/vite/bin/vite.js');
